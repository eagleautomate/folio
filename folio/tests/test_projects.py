# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Auto-created project pages. Needs ERPNext (skipped otherwise):
	bench --site folio-erp-test.localhost run-tests --app folio --skip-before-tests
"""

import json
import unittest
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from folio import projects
from folio.api import projects as project_api
from folio.api import spaces
from folio.permissions import clear_access_cache


def has_erpnext():
	return "erpnext" in frappe.get_installed_apps()


@unittest.skipUnless(has_erpnext(), "ERPNext is not installed on this site")
class TestProjectPages(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		from folio.demo.seed import complete_setup

		complete_setup()
		cls.company = frappe.db.get_value("Company", {}, "name")

	def setUp(self):
		frappe.set_user("Administrator")
		clear_access_cache()
		frappe.db.set_single_value("Folio Settings", {"auto_create_project_pages": 1, "projects_space": None})
		frappe.clear_document_cache("Folio Settings", "Folio Settings")

	def make_project(self, name=None):
		return frappe.get_doc(
			{
				"doctype": "Project",
				"project_name": name or f"Proj {frappe.generate_hash(length=6)}",
				"company": self.company,
			}
		).insert()

	def page_of(self, project):
		name = projects.get_project_page(project)
		return frappe.get_doc("Folio Page", name) if name else None

	def test_new_project_gets_a_page(self):
		project = self.make_project("Warehouse move")
		page = self.page_of(project.name)
		self.assertIsNotNone(page)
		self.assertEqual(page.title, "Warehouse move")
		self.assertTrue(page.is_project_page)
		self.assertEqual(frappe.db.get_value("Folio Space", page.space, "title"), projects.PROJECTS_SPACE_TITLE)
		blocks = json.loads(page.content)["content"]
		self.assertEqual(blocks[0], {"type": "erpnextProject", "attrs": {"project": project.name}})
		# the Projects space is remembered in settings and reused
		self.assertEqual(frappe.db.get_single_value("Folio Settings", "projects_space"), page.space)
		self.assertEqual(self.page_of(self.make_project().name).space, page.space)

	def test_configured_space_is_used(self):
		space = spaces.create_space(title="Client work")["name"]
		frappe.db.set_single_value("Folio Settings", "projects_space", space)
		frappe.clear_document_cache("Folio Settings", "Folio Settings")
		self.assertEqual(self.page_of(self.make_project().name).space, space)

	def test_linked_space_wins_when_backfilling(self):
		frappe.db.set_single_value("Folio Settings", "auto_create_project_pages", 0)
		frappe.clear_document_cache("Folio Settings", "Folio Settings")
		project = self.make_project()
		self.assertIsNone(self.page_of(project.name))  # auto-create off

		space = spaces.create_space(title="Linked")["name"]
		spaces.update_space(space, project=project.name)
		self.assertGreaterEqual(projects.create_missing_project_pages()["created"], 1)
		self.assertEqual(self.page_of(project.name).space, space)
		# idempotent
		self.assertEqual(projects.create_project_page(project.name), self.page_of(project.name).name)

	def test_linking_a_space_moves_the_project_page(self):
		project = self.make_project()
		page = projects.get_project_page(project.name)
		child = frappe.get_doc(
			{"doctype": "Folio Page", "space": self.page_of(project.name).space, "parent_page": page, "title": "Minutes"}
		).insert()
		space = spaces.create_space(title="Project team")["name"]
		spaces.update_space(space, project=project.name)
		self.assertEqual(frappe.db.get_value("Folio Page", page, ["space", "parent_page"]), (space, None))
		self.assertEqual(frappe.db.get_value("Folio Page", child.name, "space"), space)

	def test_rename_follows_unless_page_was_retitled(self):
		project = self.make_project("Old name")
		project.project_name = "New name"
		project.save()
		self.assertEqual(self.page_of(project.name).title, "New name")

		frappe.db.set_value("Folio Page", projects.get_project_page(project.name), "title", "Our own title")
		project.reload()
		project.project_name = "Third name"
		project.save()
		self.assertEqual(self.page_of(project.name).title, "Our own title")

	def test_deleting_project_trashes_page(self):
		project = self.make_project()
		page = projects.get_project_page(project.name)
		space = spaces.create_space(title="Space for deleted")["name"]
		spaces.update_space(space, project=project.name)

		frappe.delete_doc("Project", project.name)  # must not be blocked by the links
		row = frappe.db.get_value("Folio Page", page, ["is_archived", "project", "is_project_page"], as_dict=True)
		self.assertEqual((row.is_archived, row.project, row.is_project_page), (1, None, 0))
		self.assertIsNone(frappe.db.get_value("Folio Space", space, "project"))

	def test_folio_failure_never_blocks_the_project(self):
		with patch("folio.projects.create_project_page", side_effect=RuntimeError("boom")):
			project = self.make_project()
		self.assertTrue(frappe.db.exists("Project", project.name))
		self.assertIsNone(self.page_of(project.name))
		self.assertTrue(frappe.db.exists("Error Log", {"method": ["like", f"%{project.name}%"]}))

	def test_project_block_data(self):
		project = self.make_project()
		for subject, status in [("A", "Open"), ("B", "Completed"), ("C", "Open")]:
			task = frappe.get_doc({"doctype": "Task", "subject": subject, "project": project.name}).insert()
			if status != "Open":
				task.status = status
				task.save()
		data = project_api.get_project(project.name)
		self.assertEqual(data["counts"], {"total": 3, "completed": 1, "overdue": 0, "open": 2})
		self.assertEqual([t["status"] for t in data["tasks"]][-1], "Completed")  # open tasks first
		self.assertTrue(project_api.get_project("PROJ-NOPE")["missing"])
