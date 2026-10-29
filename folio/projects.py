# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""One Folio page per ERPNext Project.

Wired in hooks.py (``doc_events["Project"]``); the events simply never fire on sites
without ERPNext.

* A new Project gets a page (``is_project_page = 1``) in the projects space: the one
  chosen in Folio Settings, else a "Projects" space created on first use. Project pages
  always live there, so every project has one predictable home.
* The page body is the project's free-form Overview; the SPA adds the live header and
  the Tasks tab around it (see ``Page.vue`` / ``ProjectHeader.vue``).
* Renaming the project renames the page, unless someone gave the page another title.
* Deleting the project moves its page to the trash and clears dangling links
  (``ignore_links_on_delete`` in hooks.py lets the delete go through).

Folio must never stop ERPNext from saving a project, so page creation runs inside a
savepoint and errors are only logged.
"""

import json

import frappe
from frappe.utils import now_datetime

from folio.content import doc, h, p
from folio.utils import next_sort_order

PROJECTS_SPACE_TITLE = "Projects"


def page_template(project: str) -> dict:
	"""Starting Overview for a new project page."""
	return doc(h(2, "Goals"), p(), h(2, "Notes"), p())


def settings():
	return frappe.get_cached_doc("Folio Settings")


def get_project_page(project: str) -> str | None:
	return frappe.db.get_value("Folio Page", {"project": project, "is_project_page": 1})


def projects_space() -> str:
	"""The space that holds every project page (created on first use)."""
	configured = settings().projects_space
	if configured and frappe.db.exists("Folio Space", configured):
		return configured

	space = frappe.db.get_value("Folio Space", {"title": PROJECTS_SPACE_TITLE})
	if not space:
		space = (
			frappe.get_doc(
				{
					"doctype": "Folio Space",
					"title": PROJECTS_SPACE_TITLE,
					"icon": "📁",
					"visibility": "Workspace",
					"default_access": "Can Edit",
					"description": "One page per ERPNext project, created automatically.",
					"sort_order": next_sort_order("Folio Space", {}),
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
	frappe.db.set_single_value("Folio Settings", "projects_space", space)
	frappe.clear_document_cache("Folio Settings", "Folio Settings")
	return space


def create_project_page(project) -> str:
	"""Create (or return the existing) page for ``project`` (a Project doc or name)."""
	if isinstance(project, str):
		project = frappe.get_doc("Project", project)
	existing = get_project_page(project.name)
	if existing:
		return existing

	space = projects_space()
	page = frappe.get_doc(
		{
			"doctype": "Folio Page",
			"space": space,
			"title": project.project_name or project.name,
			"icon": "📁",
			"project": project.name,
			"is_project_page": 1,
			"content": json.dumps(page_template(project.name)),
			"sort_order": next_sort_order("Folio Page", {"space": space, "parent_page": ("is", "not set")}),
		}
	)
	page.insert(ignore_permissions=True)
	return page.name


# ---- doc_events -----------------------------------------------------------------


def on_project_insert(project, method=None):
	if not settings().auto_create_project_pages:
		return
	frappe.db.savepoint("folio_project_page")
	try:
		create_project_page(project)
	except Exception:
		frappe.db.rollback(save_point="folio_project_page")
		frappe.log_error(title=f"Folio: could not create a page for project {project.name}")


def on_project_update(project, method=None):
	before = project.get_doc_before_save()
	if not before or before.project_name == project.project_name:
		return
	page = get_project_page(project.name)
	if page and frappe.db.get_value("Folio Page", page, "title") == before.project_name:
		frappe.db.set_value("Folio Page", page, "title", project.project_name)


def on_project_trash(project, method=None):
	now = now_datetime()
	for page in frappe.get_all("Folio Page", filters={"project": project.name}, fields=["name", "is_project_page"]):
		values = {"project": None}
		if page.is_project_page:
			values.update(
				{"is_archived": 1, "archived_by": frappe.session.user, "archived_on": now, "is_project_page": 0}
			)
		frappe.db.set_value("Folio Page", page.name, values, update_modified=False)
	for space in frappe.get_all("Folio Space", filters={"project": project.name}, pluck="name"):
		frappe.db.set_value("Folio Space", space, "project", None, update_modified=False)


@frappe.whitelist(methods=["POST"])
def create_missing_project_pages() -> dict:
	"""Backfill: a page for every existing Project that doesn't have one (Folio Manager only)."""
	frappe.only_for(["System Manager", "Folio Manager"])
	have = set(frappe.get_all("Folio Page", filters={"is_project_page": 1}, pluck="project"))
	created = 0
	for name in frappe.get_all("Project", order_by="creation asc", pluck="name"):
		if name not in have:
			create_project_page(name)
			created += 1
	return {"created": created}
