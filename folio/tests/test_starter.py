# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Getting Started pages and "Copy to…"."""

import json

import frappe
from frappe.tests import IntegrationTestCase

from folio import starter
from folio.api import pages, spaces, workspace
from folio.permissions import clear_access_cache, get_space_access
from folio.tests.test_folio import make_user

READER = "starter-reader@folio.test"


class TestStarterPages(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		make_user(READER, roles=("Folio User",))

	def setUp(self):
		frappe.set_user("Administrator")
		clear_access_cache()
		# start from a site without them
		for space in frappe.get_all("Folio Space", filters={"title": starter.SPACE_TITLE}, pluck="name"):
			frappe.delete_doc("Folio Space", space, ignore_permissions=True)
		frappe.db.set_single_value("Folio Settings", "starter_pages_created", 0)

	def tearDown(self):
		frappe.set_user("Administrator")
		clear_access_cache()

	def titles(self, space):
		return set(frappe.get_all("Folio Page", filters={"space": space}, pluck="title"))

	def test_creates_space_and_pages(self):
		space = starter.create_starter_pages()
		expected = {"Welcome to Folio", "Writing pages", "Organising your work", "Who sees what", "Templates", "Meeting notes", "Project brief", "Weekly plan"}
		if starter.erpnext_installed():
			expected.add("Projects & tasks")
		self.assertEqual(self.titles(space), expected)
		# at the top of the sidebar, readable by everyone, editable by nobody but managers
		first = frappe.get_all("Folio Space", order_by="sort_order asc", limit=1, pluck="name")[0]
		self.assertEqual(first, space)
		self.assertEqual(get_space_access(space, READER), "view")
		# templates are inside the Templates page
		templates = frappe.db.get_value("Folio Page", {"space": space, "title": "Templates"})
		self.assertEqual(frappe.db.count("Folio Page", {"parent_page": templates}), 3)

	def test_links_between_pages_resolve(self):
		space = starter.create_starter_pages()
		welcome = frappe.get_doc("Folio Page", {"space": space, "title": "Welcome to Folio"})
		linked = [b["attrs"]["page"] for b in json.loads(welcome.content)["content"] if b["type"] == "pageLink"]
		self.assertGreaterEqual(len(linked), 4)
		for name in linked:
			self.assertEqual(frappe.db.get_value("Folio Page", name, "space"), space)

	def test_pages_are_searchable(self):
		starter.create_starter_pages()
		self.as_user(READER)
		self.assertIn("Writing pages", [r["title"] for r in workspace.search("checklist")])

	def test_once_per_site_but_can_be_added_back(self):
		space = starter.create_starter_pages()
		self.assertIsNone(starter.create_starter_pages())  # already done
		spaces.delete_space(space)  # a manager removed it on purpose
		self.assertIsNone(starter.create_starter_pages())  # stays removed
		again = starter.add_starter_pages()["space"]  # Folio Settings button
		self.assertIn("Welcome to Folio", self.titles(again))
		# missing pages are added, existing ones kept
		page = frappe.db.get_value("Folio Page", {"space": again, "title": "Weekly plan"})
		frappe.delete_doc("Folio Page", page, ignore_permissions=True)
		starter.add_starter_pages()
		self.assertIn("Weekly plan", self.titles(again))
		self.assertEqual(frappe.db.count("Folio Space", {"title": starter.SPACE_TITLE}), 1)

	def test_readers_copy_a_template_into_their_own_space(self):
		space = starter.create_starter_pages()
		brief = frappe.db.get_value("Folio Page", {"space": space, "title": "Project brief"})
		templates = frappe.db.get_value("Folio Page", {"space": space, "title": "Templates"})
		self.as_user(READER)
		mine = spaces.create_space(title="My notes", visibility="Private")["name"]
		self.assertRaises(frappe.PermissionError, pages.duplicate_page, brief)  # can't copy within a read-only space
		copy = pages.duplicate_page(brief, mine)
		self.assertEqual((copy["space"], copy["title"], copy["parent_page"]), (mine, "Project brief", None))
		self.assertEqual(pages.get_page(copy["name"])["access"], "full")
		# copying a page with sub-pages copies them too
		folder = pages.duplicate_page(templates, mine)
		self.assertEqual(frappe.db.count("Folio Page", {"parent_page": folder["name"]}), 3)
		self.assertEqual(frappe.db.get_value("Folio Page", {"parent_page": folder["name"], "title": "Weekly plan"}, "space"), mine)

	def as_user(self, user):
		frappe.set_user(user)
		clear_access_cache()
