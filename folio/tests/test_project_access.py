# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Pages linked to an ERPNext project follow Frappe's permission on that Project.

Needs ERPNext (skipped otherwise):
	bench --site folio-erp-test.localhost run-tests --app folio --skip-before-tests
"""

import unittest

import frappe
from frappe.permissions import add_permission
from frappe.tests import IntegrationTestCase

from folio import projects
from folio.api import pages, workspace
from folio.api import projects as project_api
from folio.permissions import clear_access_cache
from folio.tests.test_folio import make_user

NO_ROLES = "access-none@folio.test"  # Folio User only: no Project permission
PROJECTS_USER = "access-pu@folio.test"  # Projects User: read/write every Project
RESTRICTED = "access-up@folio.test"  # Projects User + User Permission to one Project
READER = "access-ro@folio.test"  # a role with read-only Project permission
READER_ROLE = "Folio Test Project Reader"


def has_erpnext():
	return "erpnext" in frappe.get_installed_apps()


@unittest.skipUnless(has_erpnext(), "ERPNext is not installed on this site")
class TestProjectPageAccess(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		from folio.demo.seed import complete_setup

		complete_setup()
		if not frappe.db.exists("Role", READER_ROLE):
			frappe.get_doc({"doctype": "Role", "role_name": READER_ROLE, "desk_access": 1}).insert()
		add_permission("Project", READER_ROLE, 0, "read")
		make_user(NO_ROLES, roles=("Folio User",))
		make_user(PROJECTS_USER, roles=("Folio User", "Projects User"))
		make_user(RESTRICTED, roles=("Folio User", "Projects User"))
		make_user(READER, roles=("Folio User", READER_ROLE))

	def setUp(self):
		frappe.set_user("Administrator")
		clear_access_cache()
		company = frappe.db.get_value("Company", {}, "name")
		self.allowed = frappe.get_doc({"doctype": "Project", "project_name": f"Allowed {frappe.generate_hash(length=5)}", "company": company}).insert()
		self.secret = frappe.get_doc({"doctype": "Project", "project_name": f"Secret {frappe.generate_hash(length=5)}", "company": company}).insert()
		frappe.db.delete("User Permission", {"user": RESTRICTED})
		frappe.get_doc(
			{"doctype": "User Permission", "user": RESTRICTED, "allow": "Project", "for_value": self.allowed.name, "apply_to_all_doctypes": 1}
		).insert()
		self.secret_page = projects.get_project_page(self.secret.name)
		self.allowed_page = projects.get_project_page(self.allowed.name)
		self.secret_sub = pages.create_page(frappe.db.get_value("Folio Page", self.secret_page, "space"), parent_page=self.secret_page, title="Secret minutes")["name"]

	def tearDown(self):
		frappe.set_user("Administrator")
		clear_access_cache()

	def as_user(self, user):
		frappe.set_user(user)
		clear_access_cache()

	def sidebar_titles(self):
		return {p.name for p in workspace.get_sidebar()["pages"]}

	def test_sub_pages_carry_the_project(self):
		self.assertEqual(frappe.db.get_value("Folio Page", self.secret_sub, "project"), self.secret.name)

	def test_no_project_permission_hides_project_pages(self):
		self.as_user(NO_ROLES)
		visible = self.sidebar_titles()
		self.assertNotIn(self.secret_page, visible)
		self.assertNotIn(self.secret_sub, visible)
		self.assertRaises(frappe.PermissionError, pages.get_page, self.secret_page)
		self.assertRaises(frappe.PermissionError, pages.get_page, self.secret_sub)
		self.assertRaises(frappe.PermissionError, pages.save_content, self.secret_page, {"type": "doc"})
		self.assertNotIn(self.secret_page, [r["name"] for r in workspace.search(self.secret.project_name)])
		self.assertNotIn(self.secret_page, frappe.get_list("Folio Page", pluck="name"))  # desk list
		self.assertFalse(frappe.get_doc("Folio Page", self.secret_page).has_permission("read"))  # desk form
		self.assertFalse(workspace.get_boot()["can_read_projects"])
		self.assertRaises(frappe.PermissionError, project_api.list_projects, "all")

	def test_user_permission_limits_to_one_project(self):
		self.as_user(RESTRICTED)
		visible = self.sidebar_titles()
		self.assertIn(self.allowed_page, visible)
		self.assertNotIn(self.secret_page, visible)
		self.assertNotIn(self.secret_sub, visible)
		self.assertEqual(pages.get_page(self.allowed_page)["access"], "edit")
		self.assertRaises(frappe.PermissionError, pages.get_page, self.secret_page)
		names = {p["name"] for p in project_api.list_projects("all")}
		self.assertIn(self.allowed.name, names)
		self.assertNotIn(self.secret.name, names)
		# can't sneak a page under the secret project page either
		space = frappe.db.get_value("Folio Page", self.secret_page, "space")
		self.assertRaises(frappe.PermissionError, pages.create_page, space, self.secret_page)

	def test_read_only_project_makes_pages_read_only(self):
		self.as_user(READER)
		page = pages.get_page(self.secret_page)
		self.assertEqual((page["access"], page["can_edit"]), ("view", False))
		self.assertEqual(pages.get_page(self.secret_sub)["access"], "view")
		self.assertRaises(frappe.PermissionError, pages.save_content, self.secret_page, {"type": "doc"})
		self.assertRaises(frappe.PermissionError, pages.update_page, self.secret_page, title="x")
		self.assertRaises(frappe.PermissionError, pages.archive_page, self.secret_page)
		row = next(p for p in workspace.get_sidebar()["pages"] if p.name == self.secret_page)
		self.assertEqual(row.access, "view")
		# can read projects but not tasks: project data without task rows, no error
		data = project_api.get_project(self.secret.name)
		self.assertFalse(data["can_read_tasks"])
		self.assertEqual(data["tasks"], [])

	def test_projects_user_keeps_full_use(self):
		self.as_user(PROJECTS_USER)
		self.assertEqual(pages.get_page(self.secret_page)["access"], "edit")
		pages.save_content(self.secret_sub, {"type": "doc", "content": [{"type": "paragraph"}]})

	def test_moving_out_from_under_a_project_drops_the_link(self):
		space = frappe.db.get_value("Folio Page", self.secret_page, "space")
		pages.move_page(self.secret_sub, space, None, 0)
		self.assertIsNone(frappe.db.get_value("Folio Page", self.secret_sub, "project"))

	def test_trash_hides_pages_of_unreadable_projects(self):
		pages.archive_page(self.secret_sub)
		self.as_user(NO_ROLES)
		self.assertNotIn(self.secret_sub, [p.name for p in pages.get_trash()])
