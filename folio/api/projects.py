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
	"percent_complete_method",
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

	can_read_tasks = bool(frappe.has_permission("Task", "read"))
	tasks = [] if not can_read_tasks else frappe.get_list(  # ERPNext row-level permissions apply
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
		"can_complete": row.percent_complete_method == "Manual" or not counts["open"],
		"can_read_tasks": can_read_tasks,
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
	if project.status != status:
		# ERPNext derives Open/Completed from task progress unless % complete is Manual
		open_tasks = frappe.db.count("Task", {"project": name, "status": ["not in", ("Completed", "Cancelled", "Template")]})
		frappe.throw(
			frappe._(
				"ERPNext marks this project Completed by itself once its tasks are done. "
				"Complete or cancel its {0} open task(s) first, or set % Complete to Manual on the project."
			).format(open_tasks),
			title=frappe._("Project still has open tasks"),
		)
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


ACTIVE = ("Open", "On hold")


@frappe.whitelist()
def list_projects(scope: str = "active", mine: int = 0, query: str | None = None) -> list[dict]:
	"""Every project the user can see, with task counts and its Folio page (projects overview).

	``scope``: ``active`` (Open + On hold), ``completed`` (Completed + Cancelled) or ``all``.
	``mine``: only projects where the user is a project member, has a task, or created it.
	"""
	require_erpnext()
	if not frappe.has_permission("Project", "read"):
		frappe.throw(
			frappe._("You don't have access to projects in ERPNext. Ask your administrator for the Projects User role."),
			frappe.PermissionError,
		)
	filters = {}
	if scope == "active":
		filters["status"] = ["in", ACTIVE]
	elif scope == "completed":
		filters["status"] = ["in", ("Completed", "Cancelled")]
	if query:
		filters["project_name"] = ["like", f"%{query}%"]

	projects = frappe.get_list(  # ERPNext permissions
		"Project", filters=filters, fields=PROJECT_FIELDS + ["owner", "modified"], order_by="modified desc", limit=500
	)
	if not projects:
		return []
	names = [p.name for p in projects]

	counts = {n: {"total": 0, "open": 0, "completed": 0, "overdue": 0} for n in names}
	can_read_tasks = bool(frappe.has_permission("Task", "read"))
	for row in [] if not can_read_tasks else frappe.get_list(
		"Task",
		filters={"project": ["in", names], "status": ["!=", "Template"]},
		fields=["project", "status", {"COUNT": "*", "as": "n"}],
		group_by="project, status",
	):
		c = counts[row.project]
		c["total"] += row.n
		c["completed" if row.status in ("Completed", "Cancelled") else "open"] += row.n
		if row.status == "Overdue":
			c["overdue"] += row.n
	# late but not yet flagged by ERPNext's daily job
	for row in [] if not can_read_tasks else frappe.get_list(
		"Task",
		# list form: two conditions on exp_end_date. Without "is set", Frappe compares
		# ifnull(exp_end_date, '0001-01-01') and every task without a due date looks late.
		filters=[
			["project", "in", names],
			["status", "not in", ("Completed", "Cancelled", "Template", "Overdue")],
			["exp_end_date", "is", "set"],
			["exp_end_date", "<", today()],
		],
		fields=["project", {"COUNT": "*", "as": "n"}],
		group_by="project",
	):
		counts[row.project]["overdue"] += row.n

	# team = project members, then anyone with an open assignment on one of its tasks
	members = {}
	for row in frappe.get_all(
		"Project User", filters={"parent": ["in", names], "parenttype": "Project"}, fields=["parent", "user"]
	):
		members.setdefault(row.parent, []).append(row.user)
	task_project = dict(
		frappe.get_all("Task", filters={"project": ["in", names]}, fields=["name", "project"], as_list=True)
	)
	if task_project:
		for row in frappe.get_all(
			"ToDo",
			filters={"reference_type": "Task", "reference_name": ["in", list(task_project)], "status": "Open"},
			fields=["reference_name", "allocated_to"],
		):
			team = members.setdefault(task_project[row.reference_name], [])
			if row.allocated_to not in team:
				team.append(row.allocated_to)
	pages = dict(
		frappe.get_all(
			"Folio Page",
			filters={"project": ["in", names], "is_project_page": 1, "is_archived": 0},
			fields=["project", "name"],
			as_list=True,
		)
	)

	me = frappe.session.user
	mine_set = None
	if cint(mine):
		assigned = set(
			frappe.get_all(
				"ToDo",
				filters={"reference_type": "Task", "allocated_to": me, "status": ["!=", "Cancelled"]},
				pluck="reference_name",
			)
		)
		task_projects = (
			set(frappe.get_all("Task", filters={"name": ["in", list(assigned)]}, pluck="project")) if assigned else set()
		)
		mine_set = {p.name for p in projects if p.owner == me or me in members.get(p.name, []) or p.name in task_projects}

	result = []
	for p in projects:
		if mine_set is not None and p.name not in mine_set:
			continue
		result.append(
			{
				**p,
				"counts": counts[p.name],
				"team": [user_info(u) for u in members.get(p.name, [])],
				"page": pages.get(p.name),
				"can_edit": bool(frappe.has_permission("Project", "write", p.name)),
				"can_complete": p.percent_complete_method == "Manual" or not counts[p.name]["open"],
			}
		)
	return result


@frappe.whitelist(methods=["POST"])
def create_project(
	project_name: str,
	expected_start_date: str | None = None,
	expected_end_date: str | None = None,
	priority: str | None = None,
) -> dict:
	"""Create an ERPNext Project from Folio; its page is made by the Project hook."""
	require_erpnext()
	project_name = (project_name or "").strip()
	if not project_name:
		frappe.throw(frappe._("Give the project a name"))
	company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
		"Global Defaults", "default_company"
	) or frappe.db.get_value("Company", {}, "name")
	project = frappe.get_doc(
		{
			"doctype": "Project",
			"project_name": project_name,
			"company": company,
			"status": "Open",
			"expected_start_date": expected_start_date or None,
			"expected_end_date": expected_end_date or None,
			"priority": priority or "Medium",
		}
	)
	project.insert()  # ERPNext permissions: needs create on Project
	from folio.projects import create_project_page

	page = create_project_page(project)  # normally done by the hook already; returns it
	return {"project": project.name, "page": page}


@frappe.whitelist()
def can_create_project() -> bool:
	return "erpnext" in frappe.get_installed_apps() and bool(frappe.has_permission("Project", "create"))
