# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import frappe
from frappe import _

from folio.permissions import check_space_access, clear_access_cache, get_space_access, is_folio_user
from folio.utils import next_sort_order

SPACE_FIELDS = ["name", "title", "icon", "description", "visibility", "default_access", "project", "sort_order"]


VISIBILITIES = ("Workspace", "Private")
DEFAULT_ACCESS = ("Can Edit", "Can View")
MEMBER_ACCESS = ("Full Access", "Can Edit", "Can View")


def is_projects_space(name: str) -> bool:
	return name == frappe.db.get_single_value("Folio Settings", "projects_space")


@frappe.whitelist()
def get_space(name: str) -> dict:
	"""Everything the space settings dialog shows."""
	access = check_space_access(name, "view")
	doc = frappe.get_doc("Folio Space", name)
	members = []
	for m in doc.members:
		full_name, image = frappe.get_cached_value("User", m.user, ["full_name", "user_image"]) or (m.user, None)
		members.append({"user": m.user, "access": m.access, "full_name": full_name or m.user, "image": image})
	project_name = None
	if doc.project and frappe.db.exists("DocType", "Project"):
		project_name = frappe.db.get_value("Project", doc.project, "project_name")
	return {
		**{f: doc.get(f) for f in SPACE_FIELDS},
		"access": access,
		"can_manage": access == "full",
		"members": members,
		"project_name": project_name,
		"is_projects_space": is_projects_space(name),
		"page_count": frappe.db.count("Folio Page", {"space": name}),
	}


@frappe.whitelist(methods=["POST"])
def create_space(title: str, icon: str | None = None, visibility: str = "Workspace", description: str | None = None) -> dict:
	if not is_folio_user():
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	doc = frappe.get_doc(
		{
			"doctype": "Folio Space",
			"title": title,
			"icon": icon,
			"visibility": visibility,
			"description": description,
			"sort_order": next_sort_order("Folio Space", {}),
		}
	).insert(ignore_permissions=True)
	clear_access_cache()
	return get_space(doc.name)


@frappe.whitelist(methods=["POST"])
def update_space(name: str, **fields) -> dict:
	check_space_access(name, "full")
	allowed = {"title", "icon", "description", "visibility", "default_access", "project"}
	values = {k: v for k, v in fields.items() if k in allowed}
	if "visibility" in values and values["visibility"] not in VISIBILITIES:
		frappe.throw(_("Invalid visibility"))
	if "default_access" in values and values["default_access"] not in DEFAULT_ACCESS:
		frappe.throw(_("Invalid default access"))
	if "project" in values:
		values["project"] = values["project"] or None
		if values["project"] and not frappe.has_permission("Project", "read", values["project"]):
			frappe.throw(_("You do not have access to project {0}").format(values["project"]), frappe.PermissionError)
	doc = frappe.get_doc("Folio Space", name)
	doc.update(values)
	doc.save(ignore_permissions=True)
	clear_access_cache()
	return get_space(name)


@frappe.whitelist(methods=["POST"])
def set_member(name: str, user: str, access: str | None = None) -> dict:
	"""Add, change or (with ``access=None``) remove a member."""
	check_space_access(name, "full")
	doc = frappe.get_doc("Folio Space", name)
	row = next((m for m in doc.members if m.user == user), None)
	was_last_owner = (
		row is not None
		and row.access == "Full Access"
		and sum(m.access == "Full Access" for m in doc.members) == 1
	)
	if access:
		if access not in MEMBER_ACCESS:
			frappe.throw(_("Invalid access level"))
		if row:
			row.access = access
		else:
			if not frappe.db.get_value("User", {"name": user, "enabled": 1, "user_type": "System User"}):
				frappe.throw(_("{0} is not an active desk user").format(user))
			doc.append("members", {"user": user, "access": access})
	elif row:
		doc.remove(row)

	# A space that has an owner must keep one. (Spaces made by a manager may start with
	# none; managers always have full access, and adding members there must still work.)
	if was_last_owner and access != "Full Access":
		frappe.throw(_("A space needs at least one member with Full Access. Give someone else Full Access first."))
	doc.save(ignore_permissions=True)
	clear_access_cache()
	if not get_space_access(name):
		return {"name": name, "left": True}  # the user removed themselves
	return get_space(name)


@frappe.whitelist(methods=["POST"])
def delete_space(name: str):
	"""Delete a space and every page in it (including its trash). Cannot be undone."""
	check_space_access(name, "full")
	if is_projects_space(name):
		frappe.throw(_("The projects space holds every project page and can't be deleted"))
	frappe.delete_doc("Folio Space", name, ignore_permissions=True)
	return {"name": name, "deleted": True}
