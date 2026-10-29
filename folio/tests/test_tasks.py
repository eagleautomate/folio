# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""ERPNext task blocks. Needs a site with ERPNext:
	bench --site folio-erp-test.localhost run-tests --app folio --skip-before-tests
On sites without ERPNext these tests are skipped.
"""

import unittest

import frappe
from frappe.tests import IntegrationTestCase

from folio.api import pages, spaces, tasks
from folio.permissions import clear_access_cache
from folio.tests.test_folio import make_user
from folio.utils import content_to_text

PM = "folio-pm@folio.test"  # Folio User + Projects User: can create/tick tasks
WRITER = "folio-writer@folio.test"  # Folio User only: can edit pages, no Task access
VIEWER = "folio-viewer@folio.test"  # Projects User, but only "Can View" on the space


def has_erpnext():
	return "erpnext" in frappe.get_installed_apps()


@unittest.skipUnless(has_erpnext(), "ERPNext is not installed on this site")
class TestTaskBlocks(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		from folio.demo.seed import complete_setup

		complete_setup()  # Project needs a company
		make_user(PM, roles=("Folio User", "Projects User"))
		make_user(WRITER, roles=("Folio User",))
		make_user(VIEWER, roles=("Folio User", "Projects User"))

	def setUp(self):
		frappe.set_user("Administrator")
		clear_access_cache()
		self.project = frappe.get_doc(
			{
				"doctype": "Project",
				"project_name": f"Folio test {frappe.generate_hash(length=6)}",
				"company": frappe.db.get_value("Company", {}, "name"),
			}
		).insert()
		self.space = spaces.create_space(title="Tasks space", visibility="Private")["name"]
		spaces.update_space(self.space, project=self.project.name)
		for user, access in [(PM, "Can Edit"), (WRITER, "Can Edit"), (VIEWER, "Can View")]:
			spaces.set_member(self.space, user, access)
		self.page = pages.create_page(self.space, title="Plan")["name"]

	def tearDown(self):
		frappe.set_user("Administrator")
		clear_access_cache()

	def as_user(self, user):
		frappe.set_user(user)
		clear_access_cache()

	def test_create_task_goes_into_space_project(self):
		self.as_user(PM)
		task = tasks.create_task(self.page, "Write the brief")
		self.assertEqual(task["project"], self.project.name)
		self.assertEqual(task["status"], "Open")
		self.assertTrue(task["can_edit"])
		self.assertEqual(frappe.db.get_value("Task", task["name"], "owner"), PM)

	def test_page_project_overrides_space_project(self):
		other = frappe.get_doc(
			{"doctype": "Project", "project_name": f"Other {frappe.generate_hash(length=6)}", "company": self.project.company}
		).insert()
		frappe.db.set_value("Folio Page", self.page, "project", other.name)
		self.as_user(PM)
		self.assertEqual(tasks.create_task(self.page, "Scoped")["project"], other.name)

	def test_tick_and_untick(self):
		self.as_user(PM)
		name = tasks.create_task(self.page, "Ship it")["name"]
		done = tasks.set_completed(name, 1)
		self.assertEqual(done["status"], "Completed")
		self.assertEqual(done["completed_by"], PM)
		reopened = tasks.set_completed(name, 0)
		self.assertEqual(reopened["status"], "Open")
		self.assertIsNone(reopened["completed_by"])

	def test_open_dependency_blocks_completion(self):
		self.as_user(PM)
		first = tasks.create_task(self.page, "First")["name"]
		second = frappe.get_doc("Task", tasks.create_task(self.page, "Second")["name"])
		second.append("depends_on", {"task": first})
		second.save()
		self.assertRaises(frappe.ValidationError, tasks.set_completed, second.name, 1)

	def test_erpnext_permissions_apply(self):
		self.as_user(PM)
		name = tasks.create_task(self.page, "Visible to PMs")["name"]

		# can edit the page, but has no Task permission in ERPNext
		self.as_user(WRITER)
		self.assertRaises(frappe.PermissionError, tasks.create_task, self.page, "Nope")
		self.assertTrue(tasks.get_tasks([name])[name]["restricted"])
		self.assertRaises(frappe.PermissionError, tasks.set_completed, name, 1)

	def test_page_viewer_cannot_create_from_page(self):
		self.as_user(VIEWER)
		self.assertRaises(frappe.PermissionError, tasks.create_task, self.page, "Nope")

	def test_missing_task(self):
		self.as_user(PM)
		self.assertTrue(tasks.get_tasks(["TASK-DOES-NOT-EXIST"])["TASK-DOES-NOT-EXIST"]["missing"])

	def test_search_ranks_page_project_first(self):
		frappe.get_doc({"doctype": "Task", "subject": "Zebra elsewhere"}).insert()
		self.as_user(PM)
		mine = tasks.create_task(self.page, "Zebra here")["name"]
		results = tasks.search_tasks(self.page, "Zebra")
		self.assertEqual(results[0]["name"], mine)

	def test_task_subject_is_searchable(self):
		doc = {"type": "doc", "content": [{"type": "erpnextTask", "attrs": {"task": "T-1", "subject": "Book venue"}}]}
		self.assertEqual(content_to_text(doc), "Book venue")

	def test_update_task_fields_and_completion(self):
		self.as_user(PM)
		name = tasks.create_task(self.page, "Draft brief")["name"]
		data = tasks.update_task(name, subject="Final brief", priority="High", exp_end_date="2026-12-01", description="<p>Hi</p>")
		self.assertEqual((data["subject"], data["priority"], str(data["due"])[:10]), ("Final brief", "High", "2026-12-01"))
		self.assertEqual(data["description"], "<p>Hi</p>")

		done = tasks.update_task(name, status="Completed")
		self.assertEqual((done["status"], done["completed_by"]), ("Completed", PM))
		reopened = tasks.update_task(name, status="Working")
		self.assertIsNone(reopened["completed_by"])

		self.assertRaises(frappe.ValidationError, tasks.update_task, name, status="Overdue")  # ERPNext's job sets it
		self.assertRaises(frappe.ValidationError, tasks.update_task, name, priority="Whenever")
		self.assertRaises(frappe.ValidationError, tasks.update_task, name, subject="  ")
		# fields outside the allow-list are ignored, not written
		tasks.update_task(name, project="SOMETHING-ELSE", subject="Final brief")
		self.assertEqual(frappe.db.get_value("Task", name, "project"), self.project.name)

	def test_set_assignees_replaces_the_set(self):
		self.as_user(PM)
		name = tasks.create_task(self.page, "Assign me")["name"]
		self.assertEqual([a["user"] for a in tasks.set_assignees(name, [PM, VIEWER])["assignees"]], [PM, VIEWER])
		self.assertEqual([a["user"] for a in tasks.set_assignees(name, [VIEWER])["assignees"]], [VIEWER])
		self.assertEqual(tasks.set_assignees(name, "[]")["assignees"], [])

	def test_editing_needs_erpnext_write_permission(self):
		self.as_user(PM)
		name = tasks.create_task(self.page, "Not yours")["name"]
		self.as_user(WRITER)
		self.assertRaises(frappe.PermissionError, tasks.get_task, name)
		self.assertRaises(frappe.PermissionError, tasks.update_task, name, subject="Hijack")
		self.assertRaises(frappe.PermissionError, tasks.set_assignees, name, [WRITER])

