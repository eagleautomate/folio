# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""ERPNext Task blocks.

A task block in a page stores only the Task name (plus a cached subject for search).
Everything shown is read live from ERPNext here, and every read/write goes through
ERPNext's own permissions (``frappe.has_permission`` / normal ``save``), never
``ignore_permissions``: a user who can't see a Task in the desk can't see it in a page.

Folio access is checked too: you must be able to edit the page to create or tick tasks
from it, and view it to read them.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, today

from folio.permissions import check_page_access

DONE = ("Completed", "Cancelled")
FIELDS = ["name", "subject", "status", "priority", "project", "exp_end_date", "completed_by", "_assign", "modified"]


def erpnext_enabled() -> bool:
	return "erpnext" in frappe.get_installed_apps() and bool(frappe.db.exists("DocType", "Task"))


def require_erpnext():
	if not erpnext_enabled():
		frappe.throw(_("Task blocks need ERPNext to be installed on this site"))


def serialize(row) -> dict:
	project_name = None
	if row.get("project"):
		project_name = frappe.db.get_value("Project", row.project, "project_name")
	return {
		"name": row.name,
		"subject": row.subject,
		"status": row.status,
		"priority": row.priority,
		"project": row.project,
		"project_name": project_name,
		"due": row.exp_end_date,
		"completed_by": row.completed_by,
		"assignees": [user_info(u) for u in json.loads(row.get("_assign") or "[]")],
		"modified": row.modified,
		"can_edit": bool(frappe.has_permission("Task", "write", row.name)),
	}


def user_info(user: str) -> dict:
	full_name, image = frappe.get_cached_value("User", user, ["full_name", "user_image"]) or (user, None)
	return {"user": user, "full_name": full_name or user, "image": image}


def default_project(page: str) -> str | None:
	"""The page's project, else its space's project."""
	project, space = frappe.db.get_value("Folio Page", page, ["project", "space"])
	return project or frappe.db.get_value("Folio Space", space, "project")


@frappe.whitelist()
def get_tasks(names: str | list) -> dict:
	"""Live data for the task blocks on a page, keyed by Task name.

	Tasks the user may not read come back as ``{"restricted": True}`` and deleted
	ones as ``{"missing": True}``, so the block can say so instead of breaking.
	"""
	require_erpnext()
	if isinstance(names, str):
		names = json.loads(names)
	result = {}
	for name in dict.fromkeys(names or []):  # dedupe, keep order
		row = frappe.db.get_value("Task", name, FIELDS, as_dict=True)
		if not row:
			result[name] = {"name": name, "missing": True}
		elif not frappe.has_permission("Task", "read", name):
			result[name] = {"name": name, "restricted": True}
		else:
			result[name] = serialize(row)
	return result


@frappe.whitelist(methods=["POST"])
def create_task(page: str, subject: str) -> dict:
	"""Create a Task from a page; it goes into the page's (or space's) project."""
	require_erpnext()
	check_page_access(page, "edit")
	subject = (subject or "").strip()
	if not subject:
		frappe.throw(_("Give the task a title"))

	task = frappe.get_doc(
		{"doctype": "Task", "subject": subject, "project": default_project(page), "status": "Open"}
	)
	task.insert()  # ERPNext permissions apply: needs create on Task (e.g. Projects User)
	return serialize(frappe.db.get_value("Task", task.name, FIELDS, as_dict=True))


@frappe.whitelist(methods=["POST"])
def set_completed(name: str, completed: int | bool) -> dict:
	"""Tick / untick a task. ERPNext's own rules apply (e.g. open dependencies block completion)."""
	require_erpnext()
	task = frappe.get_doc("Task", name)
	task.check_permission("write")
	if cint(completed):
		if task.status != "Completed":
			task.status = "Completed"
			task.completed_on = today()
			task.completed_by = frappe.session.user
	elif task.status in DONE:
		task.status = "Open"
		task.completed_on = None
		task.completed_by = None
	task.save()
	return serialize(frappe.db.get_value("Task", name, FIELDS, as_dict=True))


@frappe.whitelist()
def search_tasks(page: str, query: str | None = None, limit: int = 8) -> list[dict]:
	"""Existing tasks to link, open ones from the page's project first."""
	require_erpnext()
	check_page_access(page, "view")
	filters = {"status": ["not in", ["Template"]]}
	if query:
		filters["subject"] = ["like", f"%{query}%"]
	project = default_project(page)
	rows = frappe.get_list(  # get_list applies ERPNext's permission rules
		"Task",
		filters=filters,
		fields=["name", "subject", "status", "project"],
		order_by="modified desc",
		limit=50,
	)

	def rank(r):
		return (r.project != project, r.status in DONE)

	return sorted(rows, key=rank)[: min(cint(limit) or 8, 20)]
