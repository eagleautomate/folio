# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Page CRUD, tree moves, trash, favorites and version history.

Every endpoint checks space access itself (``folio.permissions``) and then works
with ``ignore_permissions``; the desk hooks enforce the same rules for /desk.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, now_datetime, time_diff_in_seconds

from folio.folio.doctype.folio_page.folio_page import get_descendants
from folio.permissions import check_page_access, check_space_access, has_level
from folio.utils import next_sort_order

# A new version snapshot is kept at most this often per page and author.
VERSION_INTERVAL_SECONDS = 10 * 60
PAGE_FIELDS = [
	"name",
	"title",
	"icon",
	"cover",
	"space",
	"parent_page",
	"sort_order",
	"full_width",
	"is_locked",
	"is_archived",
	"project",
	"content_version",
	"last_edited_by",
	"last_edited_on",
	"owner",
	"creation",
]


@frappe.whitelist()
def get_page(name: str) -> dict:
	access = check_page_access(name, "view")
	doc = frappe.get_doc("Folio Page", name)
	page = {f: doc.get(f) for f in PAGE_FIELDS}
	page["content"] = json.loads(doc.content) if doc.content else None
	page["access"] = access
	page["can_edit"] = has_level(access, "edit") and not doc.is_locked and not doc.is_archived
	page["breadcrumbs"] = get_breadcrumbs(doc)
	page["is_favorite"] = bool(
		frappe.db.exists("Folio Favorite", {"user": frappe.session.user, "page": name})
	)
	page["children"] = frappe.get_all(
		"Folio Page",
		filters={"parent_page": name, "is_archived": 0},
		fields=["name", "title", "icon"],
		order_by="sort_order asc, creation asc",
	)
	return page


def get_breadcrumbs(doc) -> list[dict]:
	crumbs = []
	parent = doc.parent_page
	seen = set()
	while parent and parent not in seen:
		seen.add(parent)
		row = frappe.db.get_value("Folio Page", parent, ["name", "title", "icon", "parent_page"], as_dict=True)
		if not row:
			break
		crumbs.insert(0, {"name": row.name, "title": row.title, "icon": row.icon})
		parent = row.parent_page
	space = frappe.db.get_value("Folio Space", doc.space, ["name", "title", "icon"], as_dict=True)
	return [{"space": True, **space}, *crumbs] if space else crumbs


@frappe.whitelist(methods=["POST"])
def create_page(
	space: str,
	parent_page: str | None = None,
	title: str | None = None,
	icon: str | None = None,
	content: str | dict | None = None,
) -> dict:
	check_space_access(space, "edit")
	if parent_page:
		parent_space = frappe.db.get_value("Folio Page", parent_page, "space")
		if parent_space != space:
			frappe.throw(_("Parent page must be in the same space"))

	doc = frappe.get_doc(
		{
			"doctype": "Folio Page",
			"space": space,
			"parent_page": parent_page,
			"title": title or "",
			"icon": icon,
			"content": json.dumps(content) if isinstance(content, dict) else content,
			"sort_order": next_sort_order(
				"Folio Page", {"space": space, "parent_page": parent_page or ("is", "not set")}
			),
		}
	)
	doc.insert(ignore_permissions=True)
	return {f: doc.get(f) for f in PAGE_FIELDS}


@frappe.whitelist(methods=["POST"])
def update_page(name: str, **fields) -> dict:
	"""Update meta fields (title, icon, cover, full_width, is_locked).

	Content goes through :func:`save_content` so it can detect concurrent edits.
	"""
	allowed = {"title", "icon", "cover", "full_width", "is_locked"}
	fields = {k: v for k, v in fields.items() if k in allowed}
	check_page_access(name, "edit")
	doc = frappe.get_doc("Folio Page", name)
	if doc.is_locked and set(fields) - {"is_locked"}:
		frappe.throw(_("This page is locked"))
	doc.update(fields)
	doc.save(ignore_permissions=True)
	return {f: doc.get(f) for f in PAGE_FIELDS}


@frappe.whitelist(methods=["POST"])
def save_content(name: str, content: str | dict, base_version: int | None = None, title: str | None = None) -> dict:
	"""Save the editor document.

	``base_version`` is the ``content_version`` the client started from. If someone
	*else* saved in between, nothing is written and ``conflict`` is returned with the
	latest server copy so the client can reload. Saves by the same user always win
	(e.g. two tabs), matching how people expect autosave to behave.
	"""
	check_page_access(name, "edit")
	doc = frappe.get_doc("Folio Page", name)
	if doc.is_locked:
		frappe.throw(_("This page is locked"))
	if doc.is_archived:
		frappe.throw(_("Restore this page from the trash before editing it"))

	if (
		base_version is not None
		and cint(base_version) != cint(doc.content_version)
		and doc.last_edited_by != frappe.session.user
	):
		return {
			"conflict": True,
			"content_version": doc.content_version,
			"content": json.loads(doc.content) if doc.content else None,
			"last_edited_by": doc.last_edited_by,
		}

	doc.content = json.dumps(content) if isinstance(content, dict) else content
	if title is not None:
		doc.title = title
	doc.save(ignore_permissions=True)
	maybe_snapshot(doc)
	return {
		"conflict": False,
		"content_version": doc.content_version,
		"last_edited_by": doc.last_edited_by,
		"last_edited_on": doc.last_edited_on,
	}


def maybe_snapshot(doc, force: bool = False):
	"""Keep a version every VERSION_INTERVAL_SECONDS per author, not on every keystroke."""
	if not doc.content:
		return
	last = frappe.db.get_value(
		"Folio Page Version",
		{"page": doc.name},
		["name", "owner", "creation"],
		as_dict=True,
		order_by="creation desc",
	)
	if (
		not force
		and last
		and last.owner == frappe.session.user
		and time_diff_in_seconds(now_datetime(), last.creation) < VERSION_INTERVAL_SECONDS
	):
		frappe.db.set_value(
			"Folio Page Version",
			last.name,
			{"content": doc.content, "title": doc.title, "content_version": doc.content_version},
			update_modified=True,
		)
		return
	frappe.get_doc(
		{
			"doctype": "Folio Page Version",
			"page": doc.name,
			"title": doc.title,
			"content": doc.content,
			"content_version": doc.content_version,
		}
	).insert(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def move_page(name: str, space: str, parent_page: str | None = None, index: int = 0) -> dict:
	"""Move ``name`` under ``parent_page`` (or to the top of ``space``) at ``index``."""
	check_page_access(name, "edit")
	check_space_access(space, "edit")
	parent_page = parent_page or None
	index = max(0, cint(index))

	doc = frappe.get_doc("Folio Page", name)
	if parent_page and (parent_page == name or parent_page in get_descendants(name)):
		frappe.throw(_("A page cannot be moved inside itself"))

	siblings = frappe.get_all(
		"Folio Page",
		filters={
			"space": space,
			"parent_page": parent_page or ("is", "not set"),
			"name": ["!=", name],
			"is_archived": 0,
		},
		order_by="sort_order asc, creation asc",
		pluck="name",
	)
	siblings.insert(min(index, len(siblings)), name)

	doc.space = space
	doc.parent_page = parent_page
	doc.sort_order = siblings.index(name) + 1
	doc.save(ignore_permissions=True)
	for position, sibling in enumerate(siblings, start=1):
		if sibling != name:
			frappe.db.set_value("Folio Page", sibling, "sort_order", position, update_modified=False)
	return {f: doc.get(f) for f in PAGE_FIELDS}


@frappe.whitelist(methods=["POST"])
def duplicate_page(name: str) -> dict:
	check_page_access(name, "view")
	src = frappe.get_doc("Folio Page", name)
	check_space_access(src.space, "edit")

	def copy(source, parent_page, title):
		new = frappe.copy_doc(source)
		new.update({"parent_page": parent_page, "title": title, "is_locked": 0, "content_version": 0})
		new.insert(ignore_permissions=True)
		for child in frappe.get_all(
			"Folio Page", filters={"parent_page": source.name, "is_archived": 0}, pluck="name"
		):
			child_doc = frappe.get_doc("Folio Page", child)
			copy(child_doc, new.name, child_doc.title)
		return new

	new = copy(src, src.parent_page, _("{0} (copy)").format(src.title or _("Untitled")))
	new.db_set("sort_order", (src.sort_order or 0) + 0.5, update_modified=False)
	return {f: new.get(f) for f in PAGE_FIELDS}


@frappe.whitelist(methods=["POST"])
def archive_page(name: str) -> dict:
	"""Move a page and its sub-pages to the trash."""
	check_page_access(name, "edit")
	now = now_datetime()
	for page in [name, *get_descendants(name)]:
		frappe.db.set_value(
			"Folio Page",
			page,
			{"is_archived": 1, "archived_by": frappe.session.user, "archived_on": now},
		)
	return {"name": name, "is_archived": 1}


@frappe.whitelist(methods=["POST"])
def restore_page(name: str) -> dict:
	check_page_access(name, "edit")
	doc = frappe.get_doc("Folio Page", name)
	# If the parent is still in the trash, restore to the top level of the space.
	if doc.parent_page and frappe.db.get_value("Folio Page", doc.parent_page, "is_archived"):
		doc.parent_page = None
	doc.is_archived = 0
	doc.archived_by = None
	doc.archived_on = None
	doc.save(ignore_permissions=True)
	for page in get_descendants(name):
		frappe.db.set_value("Folio Page", page, {"is_archived": 0, "archived_by": None, "archived_on": None})
	return {f: doc.get(f) for f in PAGE_FIELDS}


@frappe.whitelist(methods=["POST"])
def delete_page(name: str):
	"""Delete permanently. Only pages already in the trash can be deleted."""
	check_page_access(name, "edit")
	if not frappe.db.get_value("Folio Page", name, "is_archived"):
		frappe.throw(_("Move the page to the trash first"))
	frappe.delete_doc("Folio Page", name, ignore_permissions=True)
	return {"name": name, "deleted": True}


@frappe.whitelist()
def get_trash() -> list[dict]:
	from folio.api.workspace import get_accessible_spaces

	spaces = [s.name for s in get_accessible_spaces() if has_level(s.access, "edit")]
	if not spaces:
		return []
	pages = frappe.get_all(
		"Folio Page",
		filters={"space": ["in", spaces], "is_archived": 1},
		fields=["name", "title", "icon", "space", "parent_page", "archived_by", "archived_on"],
		order_by="archived_on desc",
		limit=200,
	)
	# Only show the top of each archived subtree.
	archived = {p.name for p in pages}
	return [p for p in pages if p.parent_page not in archived]


@frappe.whitelist(methods=["POST"])
def toggle_favorite(name: str) -> dict:
	check_page_access(name, "view")
	user = frappe.session.user
	existing = frappe.db.get_value("Folio Favorite", {"user": user, "page": name})
	if existing:
		frappe.delete_doc("Folio Favorite", existing, ignore_permissions=True)
		return {"is_favorite": False}
	frappe.get_doc(
		{
			"doctype": "Folio Favorite",
			"user": user,
			"page": name,
			"sort_order": next_sort_order("Folio Favorite", {"user": user}),
		}
	).insert(ignore_permissions=True)
	return {"is_favorite": True}


@frappe.whitelist()
def get_versions(name: str) -> list[dict]:
	check_page_access(name, "view")
	return frappe.get_all(
		"Folio Page Version",
		filters={"page": name},
		fields=["name", "title", "content_version", "owner", "creation", "modified"],
		order_by="modified desc",
		limit=100,
	)


@frappe.whitelist()
def get_version(name: str) -> dict:
	version = frappe.get_doc("Folio Page Version", name)
	check_page_access(version.page, "view")
	return {
		"name": version.name,
		"page": version.page,
		"title": version.title,
		"content": json.loads(version.content) if version.content else None,
		"owner": version.owner,
		"modified": version.modified,
	}


@frappe.whitelist(methods=["POST"])
def restore_version(name: str) -> dict:
	version = frappe.get_doc("Folio Page Version", name)
	check_page_access(version.page, "edit")
	doc = frappe.get_doc("Folio Page", version.page)
	maybe_snapshot(doc, force=True)  # keep the current state so the restore can be undone
	doc.content = version.content
	doc.title = version.title
	doc.save(ignore_permissions=True)
	maybe_snapshot(doc, force=True)
	return get_page(doc.name)
