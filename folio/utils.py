# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

import json

import frappe

# Block-level nodes after which a newline is emitted in the plain-text copy.
BLOCK_NODES = {
	"paragraph",
	"heading",
	"blockquote",
	"listItem",
	"taskItem",
	"codeBlock",
	"callout",
	"tableRow",
	"horizontalRule",
	"pageLink",
	"erpnextTask",
}


def parse_content(content) -> dict | None:
	"""Accept a ProseMirror doc as dict or JSON string; return a dict or None."""
	if not content:
		return None
	if isinstance(content, str):
		try:
			content = json.loads(content)
		except ValueError:
			return None
	return content if isinstance(content, dict) else None


def content_to_text(content) -> str:
	"""Flatten a TipTap/ProseMirror JSON document to plain text (used for search)."""
	doc = parse_content(content)
	if not doc:
		return ""

	parts: list[str] = []

	def walk(node):
		node_type = node.get("type")
		if node_type == "text":
			parts.append(node.get("text", ""))
		elif node_type == "mention":
			attrs = node.get("attrs") or {}
			parts.append("@" + (attrs.get("label") or attrs.get("id") or ""))
		elif node_type in ("pageLink", "erpnextTask"):
			attrs = node.get("attrs") or {}
			parts.append(attrs.get("title") or attrs.get("subject") or "")
		elif node_type == "hardBreak":
			parts.append("\n")
		for child in node.get("content") or []:
			walk(child)
		if node_type in BLOCK_NODES:
			parts.append("\n")

	walk(doc)
	lines = (line.strip() for line in "".join(parts).splitlines())
	return "\n".join(line for line in lines if line)


def make_snippet(text: str, query: str, width: int = 80) -> str:
	"""Short excerpt of ``text`` around the first case-insensitive hit of ``query``."""
	if not text:
		return ""
	idx = text.lower().find(query.lower()) if query else -1
	if idx < 0:
		return text[: width * 2].replace("\n", " ")
	start = max(0, idx - width)
	end = min(len(text), idx + len(query) + width)
	snippet = text[start:end].replace("\n", " ")
	return ("…" if start else "") + snippet + ("…" if end < len(text) else "")


def next_sort_order(doctype: str, filters: dict) -> float:
	"""One more than the highest ``sort_order`` among rows matching ``filters``."""
	last = frappe.get_all(doctype, filters=filters, order_by="sort_order desc", limit=1, pluck="sort_order")
	return (last[0] or 0) + 1 if last else 1
