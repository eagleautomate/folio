# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Sidebar, search, recent pages and user lookups for the Folio SPA."""

import frappe
from frappe.utils import cint, now_datetime

from folio.permissions import filter_visible_pages, get_space_access, is_folio_manager, is_folio_user
from folio.utils import make_snippet


def get_accessible_spaces() -> list[frappe._dict]:
	spaces = frappe.get_all(
		"Folio Space",
		fields=["name", "title", "icon", "visibility", "default_access", "sort_order", "project"],
		order_by="sort_order asc, creation asc",
	)
	result = []
	for space in spaces:
		space.access = get_space_access(space.name)
		if space.access:
			result.append(space)
	return result


def add_project_status(pages: list) -> None:
	"""Mark project pages with their ERPNext project's status (the sidebar hides finished ones)."""
	projects = {p.project for p in pages if p.is_project_page and p.project}
	if not projects or "erpnext" not in frappe.get_installed_apps():
		return
	status = dict(frappe.get_all("Project", filters={"name": ["in", list(projects)]}, fields=["name", "status"], as_list=True))
	for page in pages:
		if page.is_project_page and page.project:
			page.project_status = status.get(page.project)


@frappe.whitelist()
def get_sidebar() -> dict:
	"""Everything the sidebar needs in one call: spaces, the flat page tree, favorites."""
	if not is_folio_user():
		frappe.throw(frappe._("Folio is only available to desk users"), frappe.PermissionError)

	spaces = get_accessible_spaces()
	space_names = [s.name for s in spaces]
	pages = []
	if space_names:
		pages = frappe.get_all(
			"Folio Page",
			filters={"space": ["in", space_names], "is_archived": 0},
			fields=["name", "title", "icon", "space", "parent_page", "sort_order", "project", "is_project_page"],
			order_by="sort_order asc, creation asc",
		)
		# pages linked to an ERPNext project the user can't read disappear (with their sub-pages,
		# which carry the same project); read-only projects come back with access "view"
		pages = filter_visible_pages(pages)
		add_project_status(pages)

	visible = {p.name for p in pages}
	favorites = [
		f
		for f in frappe.get_all(
			"Folio Favorite",
			filters={"user": frappe.session.user},
			order_by="sort_order asc",
			pluck="page",
		)
		if f in visible
	]
	return {"spaces": spaces, "pages": pages, "favorites": favorites}


@frappe.whitelist()
def get_boot() -> dict:
	user = frappe.session.user
	info = frappe.db.get_value("User", user, ["full_name", "user_image", "email"], as_dict=True) or {}
	return {
		"user": user,
		"full_name": info.get("full_name") or user,
		"user_image": info.get("user_image"),
		"is_manager": is_folio_manager(),
		"erpnext_installed": "erpnext" in frappe.get_installed_apps(),
		# Datetimes are stored in the system timezone without an offset; the client
		# compares against this to show correct relative times in any browser timezone.
		"server_now": str(now_datetime()),
		# the space holding project pages, so the sidebar can show "All projects"
		"projects_space": frappe.db.get_single_value("Folio Settings", "projects_space"),
		# whether to offer "All projects" / "New project" at all (Frappe's Project permission)
		"can_read_projects": "erpnext" in frappe.get_installed_apps() and bool(frappe.has_permission("Project", "read")),
	}


@frappe.whitelist()
def search(query: str, limit: int = 20) -> list[dict]:
	"""Title and full-text match across every page the user can see."""
	query = (query or "").strip()
	spaces = {s.name: s for s in get_accessible_spaces()}
	if not spaces:
		return []

	fields = ["name", "title", "icon", "space", "project", "content_text", "last_edited_on"]
	base = {"space": ["in", list(spaces)], "is_archived": 0}
	limit = min(cint(limit) or 20, 50)

	if not query:
		rows = frappe.get_all("Folio Page", filters=base, fields=fields, order_by="last_edited_on desc", limit=limit * 3)
	else:
		like = f"%{query}%"
		by_title = frappe.get_all(
			"Folio Page",
			filters={**base, "title": ["like", like]},
			fields=fields,
			order_by="last_edited_on desc",
			limit=limit * 3,
		)
		seen = {r.name for r in by_title}
		by_text = frappe.get_all(
			"Folio Page",
			filters={**base, "content_text": ["like", like], "name": ["not in", list(seen) or [""]]},
			fields=fields,
			order_by="last_edited_on desc",
			limit=limit * 3,
		)
		rows = by_title + by_text

	rows = filter_visible_pages(rows)[:limit]
	return [
		{
			"name": r.name,
			"title": r.title,
			"icon": r.icon,
			"space": r.space,
			"space_title": spaces[r.space].title,
			"snippet": make_snippet(r.content_text or "", query),
			"last_edited_on": r.last_edited_on,
		}
		for r in rows
	]


@frappe.whitelist()
def get_recent(limit: int = 8) -> list[dict]:
	"""Pages the user edited or created most recently, for the home screen."""
	spaces = {s.name: s for s in get_accessible_spaces()}
	if not spaces:
		return []
	rows = frappe.get_all(
		"Folio Page",
		filters={"space": ["in", list(spaces)], "is_archived": 0},
		fields=["name", "title", "icon", "space", "project", "cover", "last_edited_by", "last_edited_on"],
		order_by="last_edited_on desc",
		limit=min(cint(limit) or 8, 30) * 3,
	)
	rows = filter_visible_pages(rows)[: min(cint(limit) or 8, 30)]
	for r in rows:
		r.space_title = spaces[r.space].title
	return rows


@frappe.whitelist()
def get_users(query: str | None = None, limit: int = 20) -> list[dict]:
	"""Enabled desk users, for @mentions and the member picker."""
	filters = {"enabled": 1, "user_type": "System User", "name": ["not in", ["Administrator", "Guest"]]}
	or_filters = None
	if query:
		like = f"%{query}%"
		or_filters = {"full_name": ["like", like], "name": ["like", like]}
	return frappe.get_all(
		"User",
		filters=filters,
		or_filters=or_filters,
		fields=["name", "full_name", "user_image"],
		order_by="full_name asc",
		limit=min(cint(limit) or 20, 100),
	)
