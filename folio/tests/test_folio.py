# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Integration tests for spaces, pages and access control.

Run on the throwaway test site, never on a site with real data:
	bench --site folio-test.localhost run-tests --app folio --skip-before-tests
"""

import frappe
from frappe.tests import IntegrationTestCase

from folio.api import pages, spaces, workspace
from folio.permissions import clear_access_cache, get_space_access
from folio.utils import content_to_text

OWNER = "folio-owner@folio.test"
MEMBER = "folio-member@folio.test"
OUTSIDER = "folio-outsider@folio.test"


def make_user(email, roles=()):
	if not frappe.db.exists("User", email):
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": email.split("@")[0],
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		)
		for role in roles:
			user.append("roles", {"role": role})
		user.insert(ignore_permissions=True)
	return email


def doc_json(*paragraphs):
	return {
		"type": "doc",
		"content": [{"type": "paragraph", "content": [{"type": "text", "text": p}]} for p in paragraphs],
	}


class FolioTestCase(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		for email in (OWNER, MEMBER, OUTSIDER):
			make_user(email, roles=("Folio User",))

	def setUp(self):
		clear_access_cache()
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		clear_access_cache()

	def as_user(self, user):
		frappe.set_user(user)
		clear_access_cache()

	def make_space(self, visibility="Workspace", owner=OWNER, **kw):
		self.as_user(owner)
		space = spaces.create_space(title=kw.pop("title", "Test Space"), visibility=visibility, **kw)
		return space["name"]


class TestContentText(IntegrationTestCase):
	def test_flattens_blocks_and_mentions(self):
		doc = {
			"type": "doc",
			"content": [
				{"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Plan"}]},
				{
					"type": "paragraph",
					"content": [
						{"type": "text", "text": "Ask "},
						{"type": "mention", "attrs": {"id": "a@x.test", "label": "Anna"}},
					],
				},
			],
		}
		self.assertEqual(content_to_text(doc), "Plan\nAsk @Anna")
		self.assertEqual(content_to_text(None), "")
		self.assertEqual(content_to_text("not json"), "")


class TestAccess(FolioTestCase):
	def test_creator_gets_full_access(self):
		space = self.make_space()
		self.assertEqual(get_space_access(space, OWNER), "full")

	def test_workspace_space_default_access(self):
		space = self.make_space(visibility="Workspace")
		self.assertEqual(get_space_access(space, OUTSIDER), "edit")
		spaces.update_space(space, default_access="Can View")
		clear_access_cache()
		self.assertEqual(get_space_access(space, OUTSIDER), "view")

	def test_private_space_hidden_from_outsiders(self):
		space = self.make_space(visibility="Private")
		page = pages.create_page(space, title="Secret")["name"]

		self.as_user(OUTSIDER)
		self.assertIsNone(get_space_access(space))
		self.assertRaises(frappe.PermissionError, pages.get_page, page)
		self.assertNotIn(space, [s.name for s in workspace.get_sidebar()["spaces"]])
		self.assertEqual(workspace.search("Secret"), [])
		# the desk list view applies the same rule
		self.assertNotIn(page, frappe.get_list("Folio Page", pluck="name"))

	def test_viewer_cannot_edit(self):
		space = self.make_space(visibility="Private")
		spaces.set_member(space, MEMBER, "Can View")
		page = pages.create_page(space, title="Read only")["name"]

		self.as_user(MEMBER)
		self.assertFalse(pages.get_page(page)["can_edit"])
		self.assertRaises(frappe.PermissionError, pages.save_content, page, doc_json("hi"))
		self.assertRaises(frappe.PermissionError, pages.create_page, space)

	def test_manager_made_private_space_accepts_members(self):
		# a manager isn't added as a member, so the space starts with no owner
		frappe.set_user("Administrator")
		space = spaces.create_space(title="Admin space", visibility="Private")["name"]
		spaces.set_member(space, MEMBER, "Can Edit")
		self.assertEqual(get_space_access(space, MEMBER), "edit")

	def test_last_owner_of_private_space_is_kept(self):
		space = self.make_space(visibility="Private")
		self.assertRaises(frappe.ValidationError, spaces.set_member, space, OWNER, "Can View")
		self.assertRaises(frappe.ValidationError, spaces.set_member, space, OWNER, None)
		spaces.set_member(space, MEMBER, "Full Access")
		spaces.set_member(space, OWNER, None)  # fine: MEMBER still owns it

	def test_website_user_has_no_access(self):
		email = "folio-website@folio.test"
		if not frappe.db.exists("User", email):
			frappe.get_doc(
				{"doctype": "User", "email": email, "first_name": "Web", "user_type": "Website User"}
			).insert(ignore_permissions=True)
		space = self.make_space()
		self.assertIsNone(get_space_access(space, email))


class TestPages(FolioTestCase):
	def test_save_content_updates_text_and_version(self):
		space = self.make_space()
		page = pages.create_page(space, title="Notes")
		result = pages.save_content(page["name"], doc_json("Hello world"), base_version=0)

		self.assertFalse(result["conflict"])
		self.assertEqual(result["content_version"], 1)
		doc = frappe.get_doc("Folio Page", page["name"])
		self.assertEqual(doc.content_text, "Hello world")
		self.assertEqual(doc.last_edited_by, OWNER)
		self.assertEqual(frappe.db.count("Folio Page Version", {"page": page["name"]}), 1)

	def test_conflict_when_someone_else_saved(self):
		space = self.make_space()
		page = pages.create_page(space, title="Shared")["name"]
		pages.save_content(page, doc_json("owner edit"), base_version=0)  # version -> 1

		self.as_user(MEMBER)
		stale = pages.save_content(page, doc_json("member edit"), base_version=0)
		self.assertTrue(stale["conflict"])
		self.assertEqual(stale["content_version"], 1)
		self.assertIn("owner edit", frappe.db.get_value("Folio Page", page, "content_text"))

		fresh = pages.save_content(page, doc_json("member edit"), base_version=1)
		self.assertFalse(fresh["conflict"])

	def test_move_reorders_and_blocks_cycles(self):
		space = self.make_space()
		a = pages.create_page(space, title="A")["name"]
		b = pages.create_page(space, title="B")["name"]
		c = pages.create_page(space, title="C", parent_page=a)["name"]

		pages.move_page(b, space, None, 0)
		top = frappe.get_all(
			"Folio Page",
			filters={"space": space, "parent_page": ["is", "not set"]},
			order_by="sort_order asc",
			pluck="name",
		)
		self.assertEqual(top, [b, a])

		self.assertRaises(frappe.ValidationError, pages.move_page, a, space, c, 0)

	def test_move_to_other_space_moves_subtree(self):
		first = self.make_space(title="First")
		second = self.make_space(title="Second")
		parent = pages.create_page(first, title="Parent")["name"]
		child = pages.create_page(first, title="Child", parent_page=parent)["name"]

		pages.move_page(parent, second, None, 0)
		self.assertEqual(frappe.db.get_value("Folio Page", child, "space"), second)

	def test_archive_restore_delete(self):
		space = self.make_space()
		parent = pages.create_page(space, title="Parent")["name"]
		child = pages.create_page(space, title="Child", parent_page=parent)["name"]

		pages.archive_page(parent)
		self.assertTrue(frappe.db.get_value("Folio Page", child, "is_archived"))
		self.assertEqual([p.name for p in pages.get_trash()], [parent])
		self.assertNotIn(parent, [p.name for p in workspace.get_sidebar()["pages"]])

		pages.restore_page(parent)
		self.assertFalse(frappe.db.get_value("Folio Page", child, "is_archived"))

		self.assertRaises(frappe.ValidationError, pages.delete_page, parent)
		pages.archive_page(parent)
		pages.delete_page(parent)
		self.assertFalse(frappe.db.exists("Folio Page", child))

	def test_duplicate_copies_subtree(self):
		space = self.make_space()
		parent = pages.create_page(space, title="Doc", content=doc_json("body"))["name"]
		pages.create_page(space, title="Sub", parent_page=parent)
		copy = pages.duplicate_page(parent)

		self.assertEqual(copy["title"], "Doc (copy)")
		self.assertEqual(frappe.db.count("Folio Page", {"parent_page": copy["name"]}), 1)

	def test_favorites_and_restore_version(self):
		space = self.make_space()
		page = pages.create_page(space, title="Fav")["name"]
		self.assertTrue(pages.toggle_favorite(page)["is_favorite"])
		self.assertIn(page, workspace.get_sidebar()["favorites"])
		self.assertFalse(pages.toggle_favorite(page)["is_favorite"])

		# quick successive saves by one author coalesce into a single version
		pages.save_content(page, doc_json("first"))
		pages.save_content(page, doc_json("second"))
		self.assertEqual(len(pages.get_versions(page)), 1)
		owner_version = pages.get_versions(page)[0]["name"]

		# another author starts a new version
		self.as_user(MEMBER)
		pages.save_content(page, doc_json("third"))
		self.assertEqual(len(pages.get_versions(page)), 2)

		self.as_user(OWNER)
		pages.restore_version(owner_version)
		self.assertEqual(frappe.db.get_value("Folio Page", page, "content_text"), "second")

	def test_parent_must_share_space(self):
		first = self.make_space(title="First")
		second = self.make_space(title="Second")
		parent = pages.create_page(first, title="Parent")["name"]
		self.assertRaises(frappe.ValidationError, pages.create_page, second, parent)
