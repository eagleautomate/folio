# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import frappe

ROLES = ["Folio Manager", "Folio User"]


def before_install():
	# DocType permissions reference "Folio Manager", so the role must exist before sync.
	create_roles()


def after_install():
	create_roles()
	ensure_settings()
	backfill_project_pages_if_enabled()
	create_starter_pages()


def after_migrate():
	create_roles()
	ensure_settings()


def ensure_settings():
	"""Store defaults for Folio Settings (a Single) the first time, without overriding a choice."""
	if not frappe.db.exists("Singles", {"doctype": "Folio Settings", "field": "auto_create_project_pages"}):
		frappe.db.set_single_value("Folio Settings", "auto_create_project_pages", 1)


def create_roles():
	for role in ROLES:
		if not frappe.db.exists("Role", role):
			frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(
				ignore_permissions=True
			)


def backfill_project_pages_if_enabled():
	"""Projects that existed before Folio get their pages too (unless auto-creation is off)."""
	if not frappe.db.get_single_value("Folio Settings", "auto_create_project_pages"):
		return
	from folio.projects import backfill_project_pages

	backfill_project_pages()


def create_starter_pages():
	"""The Getting Started space (once per site; see folio/starter.py)."""
	from folio.starter import create_starter_pages as create

	create()
