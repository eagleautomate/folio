# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

from folio.utils import content_to_text, parse_content


class FolioPage(Document):
	def validate(self):
		self.title = (self.title or "").strip()
		self.normalize_content()
		self.validate_parent()

	def normalize_content(self):
		doc = parse_content(self.content)
		self.content = json.dumps(doc) if doc else None
		self.content_text = content_to_text(doc)

	def validate_parent(self):
		if not self.parent_page:
			return
		if self.parent_page == self.name:
			frappe.throw(_("A page cannot be its own parent"))

		parent_space = frappe.db.get_value("Folio Page", self.parent_page, "space")
		if not parent_space:
			frappe.throw(_("Parent page {0} does not exist").format(self.parent_page))
		if parent_space != self.space:
			frappe.throw(_("A page must be in the same space as its parent"))

		if not self.is_new() and self.parent_page in get_descendants(self.name):
			frappe.throw(_("A page cannot be moved inside one of its own sub-pages"))

	def before_save(self):
		if self.has_value_changed("content") or self.has_value_changed("title"):
			self.last_edited_by = frappe.session.user
			self.last_edited_on = now_datetime()
		if not self.is_new() and self.has_value_changed("content"):
			self.content_version = (self.content_version or 0) + 1

	def on_update(self):
		# Moving a page to another space moves its whole subtree with it.
		if not self.is_new() and self.has_value_changed("space"):
			for child in get_descendants(self.name):
				frappe.db.set_value("Folio Page", child, "space", self.space, update_modified=False)

	def on_trash(self):
		for child in frappe.get_all("Folio Page", filters={"parent_page": self.name}, pluck="name"):
			frappe.delete_doc("Folio Page", child, ignore_permissions=True)
		frappe.db.delete("Folio Page Version", {"page": self.name})
		frappe.db.delete("Folio Favorite", {"page": self.name})


def get_descendants(page: str) -> list[str]:
	"""All sub-page names under ``page`` (breadth first), excluding ``page`` itself."""
	result: list[str] = []
	frontier = [page]
	while frontier:
		children = frappe.get_all("Folio Page", filters={"parent_page": ["in", frontier]}, pluck="name")
		children = [c for c in children if c not in result and c != page]
		result.extend(children)
		frontier = children
	return result
