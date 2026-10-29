# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Project pages now get their header and Tasks tab from the app, not from a block.

* remove the embedded project block from every project page body
* move project pages (and their sub-pages) into the projects space
"""

import json

import frappe


def execute():
	if not frappe.db.has_column("Folio Page", "is_project_page"):
		return
	pages = frappe.get_all("Folio Page", filters={"is_project_page": 1}, pluck="name")
	if not pages:
		return

	from folio.projects import projects_space

	target = projects_space()
	for name in pages:
		page = frappe.get_doc("Folio Page", name)
		content = json.loads(page.content) if page.content else None
		if content and content.get("content"):
			content["content"] = [b for b in content["content"] if b.get("type") != "erpnextProject"]
			if not content["content"]:
				content["content"] = [{"type": "paragraph"}]
			page.content = json.dumps(content)
		if page.space != target:
			page.space = target
			page.parent_page = None
		page.save(ignore_permissions=True)  # moves sub-pages along (FolioPage.on_update)
