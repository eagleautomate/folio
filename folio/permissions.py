# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Access control for Folio.

Access is decided per *space*; every page inherits the access of its space.

Levels (lowest to highest): ``view`` < ``edit`` < ``full``.

* Folio Manager / System Manager / Administrator: ``full`` on every space.
* Explicit members of a space: the level on their member row.
* Everyone else (desk users only): the space's ``default_access`` when its
  visibility is ``Workspace``, nothing when it is ``Private``.

The same rules back the desk (``has_permission`` / ``permission_query_conditions``
hooks) and the Folio API, so a page hidden in the SPA is hidden in /desk too.
"""

import frappe

LEVELS = {"view": 1, "edit": 2, "full": 3}
MEMBER_ACCESS = {"Full Access": "full", "Can Edit": "edit", "Can View": "view"}
DEFAULT_ACCESS = {"Can Edit": "edit", "Can View": "view"}
MANAGER_ROLES = {"System Manager", "Folio Manager"}


def is_folio_manager(user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	return bool(MANAGER_ROLES.intersection(frappe.get_roles(user)))


def is_folio_user(user: str | None = None) -> bool:
	"""Only desk (System) users may use Folio; website users and guests may not."""
	user = user or frappe.session.user
	if user == "Guest":
		return False
	return user == "Administrator" or frappe.get_cached_value("User", user, "user_type") == "System User"


def get_space_access(space: str, user: str | None = None) -> str | None:
	"""Return ``"full"``, ``"edit"``, ``"view"`` or ``None`` for ``user`` on ``space``."""
	user = user or frappe.session.user
	if not space or not is_folio_user(user):
		return None

	cache = getattr(frappe.local, "folio_space_access", None)
	if cache is None:
		cache = frappe.local.folio_space_access = {}
	key = (space, user)
	if key not in cache:
		cache[key] = _compute_space_access(space, user)
	return cache[key]


def _compute_space_access(space: str, user: str) -> str | None:
	if is_folio_manager(user):
		return "full"

	row = frappe.db.get_value("Folio Space", space, ["visibility", "default_access"], as_dict=True)
	if not row:
		return None

	member_access = frappe.db.get_value(
		"Folio Space Member", {"parent": space, "parenttype": "Folio Space", "user": user}, "access"
	)
	if member_access:
		return MEMBER_ACCESS.get(member_access)

	if row.visibility == "Workspace":
		return DEFAULT_ACCESS.get(row.default_access, "edit")
	return None


def has_level(access: str | None, required: str) -> bool:
	return bool(access) and LEVELS[access] >= LEVELS[required]


def check_space_access(space: str, required: str = "view") -> str:
	"""Throw ``PermissionError`` unless the session user has ``required`` on ``space``."""
	access = get_space_access(space)
	if not has_level(access, required):
		frappe.throw(frappe._("You do not have access to this space"), frappe.PermissionError)
	return access


def check_page_access(page: str, required: str = "view") -> str:
	space = frappe.db.get_value("Folio Page", page, "space")
	if not space:
		frappe.throw(frappe._("Page {0} not found").format(page), frappe.DoesNotExistError)
	return check_space_access(space, required)


def clear_access_cache():
	frappe.local.folio_space_access = {}


# ---- desk hooks ---------------------------------------------------------------

PTYPE_LEVEL = {"read": "view", "select": "view", "print": "view", "email": "view", "report": "view"}


def _required_for_page(ptype: str) -> str:
	return PTYPE_LEVEL.get(ptype, "edit")


def _required_for_space(ptype: str) -> str:
	# Members with "Can Edit" can add pages, but only "Full Access" may change the space itself.
	return PTYPE_LEVEL.get(ptype, "full")


def space_has_permission(doc, ptype=None, user=None, debug=False):
	if doc.is_new():
		# Any Folio user may create a space; they become its first Full Access member.
		return is_folio_user(user)
	return has_level(get_space_access(doc.name, user), _required_for_space(ptype or "read"))


def page_has_permission(doc, ptype=None, user=None, debug=False):
	return has_level(get_space_access(doc.space, user), _required_for_page(ptype or "read"))


def version_has_permission(doc, ptype=None, user=None, debug=False):
	space = frappe.db.get_value("Folio Page", doc.page, "space")
	return has_level(get_space_access(space, user), _required_for_page(ptype or "read"))


def _visible_spaces_sql(user: str) -> str:
	user = frappe.db.escape(user)
	return (
		"select `tabFolio Space`.name from `tabFolio Space` "
		"where `tabFolio Space`.visibility = 'Workspace' "
		"or `tabFolio Space`.name in ("
		"select parent from `tabFolio Space Member` "
		f"where parenttype = 'Folio Space' and user = {user})"
	)


def space_query_conditions(user=None):
	user = user or frappe.session.user
	if is_folio_manager(user):
		return ""
	if not is_folio_user(user):
		return "1=0"
	return f"`tabFolio Space`.name in ({_visible_spaces_sql(user)})"


def page_query_conditions(user=None):
	user = user or frappe.session.user
	if is_folio_manager(user):
		return ""
	if not is_folio_user(user):
		return "1=0"
	return f"`tabFolio Page`.space in ({_visible_spaces_sql(user)})"


def version_query_conditions(user=None):
	user = user or frappe.session.user
	if is_folio_manager(user):
		return ""
	if not is_folio_user(user):
		return "1=0"
	return (
		"`tabFolio Page Version`.page in (select name from `tabFolio Page` "
		f"where space in ({_visible_spaces_sql(user)}))"
	)


def favorite_query_conditions(user=None):
	user = user or frappe.session.user
	if user == "Administrator":
		return ""
	return f"`tabFolio Favorite`.user = {frappe.db.escape(user)}"
