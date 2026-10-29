# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Sub-pages of project pages now carry the project link (it decides ERPNext-based access)."""

import frappe

from folio.folio.doctype.folio_page.folio_page import get_descendants


def execute():
	if not frappe.db.has_column("Folio Page", "is_project_page"):
		return
	for page in frappe.get_all("Folio Page", filters={"is_project_page": 1}, fields=["name", "project"]):
		for child in get_descendants(page.name):
			frappe.db.set_value("Folio Page", child, "project", page.project, update_modified=False)
