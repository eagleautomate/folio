# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Live project data for project page headers, Tasks tabs and project cards.

Same rules as task blocks: ERPNext permissions apply.
"""

import json

import frappe
from frappe.utils import cint, getdate, today

from folio.api.tasks import FIELDS as TASK_FIELDS
from folio.api.tasks import require_erpnext, serialize, user_info

STATUSES = ("Open", "On hold", "Completed", "Cancelled")

PROJECT_FIELDS = [
	"name",
	"project_name",
	"status",
	"percent_complete",
	"expected_start_date",
	"expected_end_date",
	"priority",
	"customer",
]


@frappe.whitelist()
def get_project(name: str, limit: int = 100) -> dict:
	"""Project summary plus its tasks (open first), for the project block."""
	require_erpnext()
	row = frappe.db.get_value("Project", name, PROJECT_FIELDS, as_dict=True)
	if not row:
		return {"name": name, "missing": True}
	if not frappe.has_permission("Project", "read", name):
		return {"name": name, "restricted": True}

	tasks = frappe.get_list(  # ERPNext row-level permissions apply
		"Task",
		filters={"project": name, "status": ["!=", "Template"]},
		fields=TASK_FIELDS,
		order_by="exp_end_date asc, creation asc",
		limit=min(cint(limit) or 100, 500),
	)
	done = ("Completed", "Cancelled")
	tasks.sort(key=lambda t: t.status in done)  # stable: open tasks first, by due date
	counts = {"total": len(tasks), "completed": 0, "overdue": 0, "open": 0}
	for t in tasks:
		if t.status in done:
			counts["completed"] += 1
		else:
			counts["open"] += 1
			if t.status == "Overdue" or (t.exp_end_date and getdate(t.exp_end_date) < getdate(today())):
				counts["overdue"] += 1

	# team = the project's Users table, then anyone assigned a task in it
	team = frappe.get_all("Project User", filters={"parent": name, "parenttype": "Project"}, pluck="user")
	for t in tasks:
		team.extend(json_list(t.get("_assign")))
	serialized = [serialize(t) for t in tasks]

	return {
		**row,
		"page": frappe.db.get_value("Folio Page", {"project": name, "is_project_page": 1, "is_archived": 0}),
		"customer_name": frappe.db.get_value("Customer", row.customer, "customer_name") if row.customer else None,
		"team": [user_info(u) for u in dict.fromkeys(team) if u],
		"can_edit": bool(frappe.has_permission("Project", "write", name)),
		"can_create_task": bool(frappe.has_permission("Task", "create")),
		"counts": counts,
		"tasks": serialized,
	}


def json_list(value) -> list:
	try:
		return json.loads(value or "[]")
	except ValueError:
		return []


@frappe.whitelist(methods=["POST"])
def set_status(name: str, status: str) -> dict:
	"""Change the project status from its page header (ERPNext permissions + validation)."""
	require_erpnext()
	if status not in STATUSES:
		frappe.throw(frappe._("Invalid status"))
	project = frappe.get_doc("Project", name)
	project.check_permission("write")
	project.status = status
	project.save()
	return get_project(name)


@frappe.whitelist()
def search_projects(query: str | None = None, limit: int = 10) -> list[dict]:
	require_erpnext()
	filters = {"project_name": ["like", f"%{query}%"]} if query else {}
	return frappe.get_list(
		"Project",
		filters=filters,
		fields=["name", "project_name", "status"],
		order_by="modified desc",
		limit=min(cint(limit) or 10, 30),
	)
