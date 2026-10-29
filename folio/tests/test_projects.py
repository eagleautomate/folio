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
from folio.api import pages, spaces, tasks
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
		# the body is the free-form Overview; header and Tasks tab come from the app
		blocks = json.loads(page.content)["content"]
		self.assertNotIn("erpnextProject", [b["type"] for b in blocks])
		# the Projects space is remembered in settings and reused
		self.assertEqual(frappe.db.get_single_value("Folio Settings", "projects_space"), page.space)
		self.assertEqual(self.page_of(self.make_project().name).space, page.space)

	def test_configured_space_is_used(self):
		space = spaces.create_space(title="Client work")["name"]
		frappe.db.set_single_value("Folio Settings", "projects_space", space)
		frappe.clear_document_cache("Folio Settings", "Folio Settings")
		self.assertEqual(self.page_of(self.make_project().name).space, space)

	def test_backfill_always_uses_projects_space(self):
		frappe.db.set_single_value("Folio Settings", "auto_create_project_pages", 0)
		frappe.clear_document_cache("Folio Settings", "Folio Settings")
		project = self.make_project()
		self.assertIsNone(self.page_of(project.name))  # auto-create off

		team_space = spaces.create_space(title="Linked team")["name"]
		spaces.update_space(team_space, project=project.name)  # linking doesn't move anything
		self.assertGreaterEqual(projects.create_missing_project_pages()["created"], 1)
		self.assertEqual(self.page_of(project.name).space, projects.projects_space())
		# idempotent
		self.assertEqual(projects.create_project_page(project.name), self.page_of(project.name).name)

	def test_project_page_stays_in_projects_space(self):
		project = self.make_project()
		page = self.page_of(project.name)
		other = spaces.create_space(title="Elsewhere")["name"]
		self.assertRaises(frappe.ValidationError, pages.move_page, page.name, other, None, 0)
		pages.move_page(page.name, page.space, None, 0)  # reordering inside is fine

	def test_tasks_on_a_project_page_belong_to_that_project(self):
		project = self.make_project()
		other = self.make_project()
		page = projects.get_project_page(project.name)
		elsewhere = frappe.get_doc({"doctype": "Task", "subject": "Unrelated zebra", "project": other.name}).insert()

		self.assertEqual(tasks.create_task(page, "Zebra one")["project"], project.name)
		self.assertRaises(frappe.ValidationError, tasks.create_task, page, "Wrong", other.name)
		found = [t["name"] for t in tasks.search_tasks(page, "zebra")]
		self.assertNotIn(elsewhere.name, found)
		self.assertEqual(len(found), 1)

	def test_status_change_from_header(self):
		project = self.make_project()
		self.assertEqual(project_api.set_status(project.name, "On hold")["status"], "On hold")
		self.assertRaises(frappe.ValidationError, project_api.set_status, project.name, "Bogus")
		data = project_api.get_project(project.name)
		self.assertEqual(data["page"], projects.get_project_page(project.name))

	def test_patch_cleans_up_old_project_pages(self):
		from folio.patches.v0_1 import project_page_layout

		project = self.make_project()
		name = projects.get_project_page(project.name)
		old_space = spaces.create_space(title="Old home")["name"]
		frappe.db.set_value(
			"Folio Page",
			name,
			{
				"space": old_space,
				"content": json.dumps(
					{"type": "doc", "content": [{"type": "erpnextProject", "attrs": {"project": project.name}}]}
				),
			},
		)
		project_page_layout.execute()
		page = frappe.get_doc("Folio Page", name)
		self.assertEqual(page.space, projects.projects_space())
		self.assertEqual(json.loads(page.content)["content"], [{"type": "paragraph"}])

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

	def test_list_projects_counts_scope_and_mine(self):
		user = "folio-proj-member@folio.test"
		from folio.tests.test_folio import make_user

		make_user(user, roles=("Folio User", "Projects User"))
		active = self.make_project()
		done = self.make_project()
		done.status = "Completed"
		done.save()
		for subject, status, due in [("a", "Open", "2020-01-01"), ("b", "Completed", None), ("c", "Working", None)]:
			t = frappe.get_doc({"doctype": "Task", "subject": subject, "project": active.name, "exp_end_date": due}).insert()
			if status != "Open":
				t.status = status
				t.save()

		rows = {p["name"]: p for p in project_api.list_projects("active")}
		self.assertIn(active.name, rows)
		self.assertNotIn(done.name, rows)
		self.assertEqual(rows[active.name]["counts"], {"total": 3, "open": 2, "completed": 1, "overdue": 1})
		self.assertEqual(rows[active.name]["page"], projects.get_project_page(active.name))
		self.assertIn(done.name, [p["name"] for p in project_api.list_projects("completed")])
		self.assertEqual({active.name, done.name} - {p["name"] for p in project_api.list_projects("all")}, set())

		# "mine": member of the project's Users table
		proj = frappe.get_doc("Project", active.name)
		proj.append("users", {"user": user, "welcome_email_sent": 1})  # no mail server on the test site
		proj.save()
		frappe.set_user(user)
		mine = [p["name"] for p in project_api.list_projects("all", mine=1)]
		self.assertIn(active.name, mine)
		self.assertNotIn(done.name, mine)

	def test_create_project_from_folio(self):
		result = project_api.create_project("Made in Folio", "2026-11-01", "2026-12-31", "High")
		project = frappe.get_doc("Project", result["project"])
		self.assertEqual((project.project_name, project.priority, str(project.expected_end_date)), ("Made in Folio", "High", "2026-12-31"))
		self.assertEqual(result["page"], projects.get_project_page(project.name))
		self.assertRaises(frappe.ValidationError, project_api.create_project, "   ")

	def test_create_project_needs_erpnext_permission(self):
		from folio.tests.test_folio import make_user

		make_user("folio-no-projects@folio.test", roles=("Folio User",))
		frappe.set_user("folio-no-projects@folio.test")
		self.assertFalse(project_api.can_create_project())
		self.assertRaises(frappe.PermissionError, project_api.create_project, "Nope")

