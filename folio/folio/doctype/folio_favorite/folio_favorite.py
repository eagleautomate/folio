# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class FolioFavorite(Document):
	def validate(self):
		if frappe.db.exists("Folio Favorite", {"user": self.user, "page": self.page, "name": ["!=", self.name]}):
			frappe.throw(_("This page is already a favorite"), frappe.DuplicateEntryError)
