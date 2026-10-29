# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Tiny builders for TipTap/ProseMirror JSON, used by the demo seeder and tests."""


def text(value, *marks, href=None):
	node = {"type": "text", "text": value}
	mark_list = [{"type": m} for m in marks]
	if href:
		mark_list.append({"type": "link", "attrs": {"href": href}})
	if mark_list:
		node["marks"] = mark_list
	return node


def _inline(parts):
	return [text(p) if isinstance(p, str) else p for p in parts]


def p(*parts):
	return {"type": "paragraph", "content": _inline(parts)} if parts else {"type": "paragraph"}


def h(level, value):
	return {"type": "heading", "attrs": {"level": level}, "content": [text(value)]}


def bullets(*items):
	return {"type": "bulletList", "content": [{"type": "listItem", "content": [p(*_as_parts(i))]} for i in items]}


def numbered(*items):
	return {"type": "orderedList", "attrs": {"start": 1}, "content": [{"type": "listItem", "content": [p(*_as_parts(i))]} for i in items]}


def todos(*items):
	"""items: (label, checked) tuples."""
	return {
		"type": "taskList",
		"content": [
			{"type": "taskItem", "attrs": {"checked": checked}, "content": [p(*_as_parts(label))]}
			for label, checked in items
		],
	}


def quote(*parts):
	return {"type": "blockquote", "content": [p(*parts)]}


def callout(emoji, *parts):
	return {"type": "callout", "attrs": {"emoji": emoji}, "content": [p(*parts)]}


def code(source, language="plaintext"):
	return {"type": "codeBlock", "attrs": {"language": language}, "content": [text(source)]}


def hr():
	return {"type": "horizontalRule"}


def mention(user, label):
	return {"type": "mention", "attrs": {"id": user, "label": label}}


def page_link(page, title):
	return {"type": "pageLink", "attrs": {"page": page, "title": title}}


def table(header, *rows):
	def cell(kind, value):
		return {"type": kind, "attrs": {"colspan": 1, "rowspan": 1, "colwidth": None}, "content": [p(value)]}

	return {
		"type": "table",
		"content": [
			{"type": "tableRow", "content": [cell("tableHeader", c) for c in header]},
			*({"type": "tableRow", "content": [cell("tableCell", c) for c in row]} for row in rows),
		],
	}


def doc(*blocks):
	return {"type": "doc", "content": list(blocks)}


def _as_parts(item):
	return item if isinstance(item, (list, tuple)) else [item]
