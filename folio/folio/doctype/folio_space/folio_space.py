# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from folio.permissions import clear_access_cache


class FolioSpace(Document):
	def validate(self):
		self.title = (self.title or "").strip()
		if not self.title:
			frappe.throw(_("Space title is required"))
		self.dedupe_members()

	def before_insert(self):
		# The creator always keeps full access to a space they made.
		user = frappe.session.user
		if user not in ("Administrator", "Guest") and not any(m.user == user for m in self.members):
			self.append("members", {"user": user, "access": "Full Access"})

	def dedupe_members(self):
		seen = set()
		for row in list(self.members):
			if row.user in seen:
				self.remove(row)
			seen.add(row.user)

	def on_update(self):
		clear_access_cache()

	def on_trash(self):
		for page in frappe.get_all(
			"Folio Page", filters={"space": self.name, "parent_page": ["is", "not set"]}, pluck="name"
		):
			frappe.delete_doc("Folio Page", page, ignore_permissions=True)
		clear_access_cache()
