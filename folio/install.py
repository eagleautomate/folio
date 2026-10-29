# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import frappe

ROLES = ["Folio Manager", "Folio User"]


def before_install():
	# DocType permissions reference "Folio Manager", so the role must exist before sync.
	create_roles()


def after_install():
	create_roles()


def after_migrate():
	create_roles()


def create_roles():
	for role in ROLES:
		if not frappe.db.exists("Role", role):
			frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(
				ignore_permissions=True
			)
