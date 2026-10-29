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
from frappe.desk.form import assign_to
from frappe.utils import cint, today

from folio.permissions import check_page_access

DONE = ("Completed", "Cancelled")
# Statuses a person can choose. "Overdue" is set by ERPNext's daily job, "Template" is for templates.
SETTABLE_STATUSES = ("Open", "Working", "Pending Review", "Completed", "Cancelled")
PRIORITIES = ("Low", "Medium", "High", "Urgent")
EDITABLE = ("subject", "status", "priority", "exp_start_date", "exp_end_date", "description")
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


def locked_project(page: str) -> str | None:
	"""On a project page, every task belongs to that page's project."""
	project, is_project_page = frappe.db.get_value("Folio Page", page, ["project", "is_project_page"])
	return project if is_project_page else None


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
def create_task(page: str, subject: str, project: str | None = None) -> dict:
	"""Create a Task from a page.

	It goes into ``project`` when given (project blocks), else the page's or space's project.
	"""
	require_erpnext()
	check_page_access(page, "edit")
	subject = (subject or "").strip()
	if not subject:
		frappe.throw(_("Give the task a title"))
	locked = locked_project(page)
	if locked and project and project != locked:
		frappe.throw(_("Tasks on this page belong to project {0}").format(locked))
	project = project or locked
	if project and not frappe.has_permission("Project", "read", project):
		frappe.throw(_("You do not have access to project {0}").format(project), frappe.PermissionError)

	task = frappe.get_doc(
		{"doctype": "Task", "subject": subject, "project": project or default_project(page), "status": "Open"}
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
	locked = locked_project(page)
	if locked:
		filters["project"] = locked  # a project page only references its own tasks
	project = locked or default_project(page)
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


@frappe.whitelist()
def get_task(name: str) -> dict:
	"""Everything the task side panel shows (adds description and start date)."""
	require_erpnext()
	task = frappe.get_doc("Task", name)
	task.check_permission("read")
	data = serialize(frappe.db.get_value("Task", name, FIELDS, as_dict=True))
	data.update(
		{
			"description": task.description,
			"start": task.exp_start_date,
			"owner": task.owner,
			"creation": task.creation,
		}
	)
	return data


@frappe.whitelist(methods=["POST"])
def update_task(name: str, **fields) -> dict:
	"""Edit a task from the board/table/panel. ERPNext permissions and validation apply."""
	require_erpnext()
	values = {k: v for k, v in fields.items() if k in EDITABLE}
	if "status" in values and values["status"] not in SETTABLE_STATUSES:
		frappe.throw(_("Status {0} can't be set by hand").format(values["status"]))
	if "priority" in values and values["priority"] not in PRIORITIES:
		frappe.throw(_("Invalid priority"))
	if "subject" in values and not (values["subject"] or "").strip():
		frappe.throw(_("A task needs a title"))

	task = frappe.get_doc("Task", name)
	task.check_permission("write")
	was_done = task.status in DONE
	task.update(values)
	if task.status == "Completed" and not was_done:
		task.completed_on = today()
		task.completed_by = frappe.session.user
	elif task.status not in DONE and was_done:
		task.completed_on = None
		task.completed_by = None
	task.save()
	return get_task(name)


@frappe.whitelist(methods=["POST"])
def set_assignees(name: str, users: str | list) -> dict:
	"""Replace a task's assignees (board: drag to another person; panel: assignee picker)."""
	require_erpnext()
	if isinstance(users, str):
		users = json.loads(users)
	users = [u for u in dict.fromkeys(users or []) if u]
	task = frappe.get_doc("Task", name)
	task.check_permission("write")

	current = json.loads(task.get("_assign") or "[]")
	for user in current:
		if user not in users:
			assign_to.remove("Task", name, user)
	new = [u for u in users if u not in current]
	if new:
		assign_to.add({"assign_to": new, "doctype": "Task", "name": name, "notify": 1})
	return get_task(name)
