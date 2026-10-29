# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import frappe
from frappe import _

from folio.permissions import check_space_access, clear_access_cache, get_space_access, is_folio_user
from folio.utils import next_sort_order

SPACE_FIELDS = ["name", "title", "icon", "description", "visibility", "default_access", "project", "sort_order"]


@frappe.whitelist()
def get_space(name: str) -> dict:
	access = check_space_access(name, "view")
	doc = frappe.get_doc("Folio Space", name)
	return {
		**{f: doc.get(f) for f in SPACE_FIELDS},
		"access": access,
		"members": [{"user": m.user, "access": m.access} for m in doc.members],
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
	doc = frappe.get_doc("Folio Space", name)
	doc.update({k: v for k, v in fields.items() if k in allowed})
	doc.save(ignore_permissions=True)
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
		if access not in ("Full Access", "Can Edit", "Can View"):
			frappe.throw(_("Invalid access level"))
		if row:
			row.access = access
		else:
			doc.append("members", {"user": user, "access": access})
	elif row:
		doc.remove(row)

	# Only guard the last owner of a private space; spaces made by a manager may have none
	# (managers always have full access), and adding members to those must still work.
	if was_last_owner and access != "Full Access" and doc.visibility == "Private":
		frappe.throw(_("A private space needs at least one member with Full Access"))
	doc.save(ignore_permissions=True)
	clear_access_cache()
	if not get_space_access(name):
		return {"name": name, "left": True}  # the user removed themselves
	return get_space(name)


@frappe.whitelist(methods=["POST"])
def delete_space(name: str):
	check_space_access(name, "full")
	frappe.delete_doc("Folio Space", name, ignore_permissions=True)
	return {"name": name, "deleted": True}
