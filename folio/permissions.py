# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Access control for Folio.

Access is decided per *space*; every page inherits the access of its space.

Levels (lowest to highest): ``view`` < ``edit`` < ``full``.

* Folio Manager / System Manager / Administrator: ``full`` on every space.
* Explicit members of a space: the level on their member row.
* Everyone else (desk users only): the space's ``default_access`` when its
  visibility is ``Workspace``, nothing when it is ``Private``.

**Pages linked to an ERPNext project** (``Folio Page.project``: project pages and
their sub-pages) are additionally capped by Frappe's own permission on that Project,
for the same user (role permissions and User Permissions both apply):

* no ``read`` on the Project  → no access to the page at all
* ``read`` but no ``write``   → at most ``view``

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


def erpnext_installed() -> bool:
	return "erpnext" in frappe.get_installed_apps()


def get_project_cap(project: str | None, user: str | None = None) -> str | None:
	"""The most a user may do on a page linked to ``project``, per Frappe's Project permission.

	``"full"`` when there's no project (no cap), ``"edit"``/``"view"``/``None`` otherwise.
	"""
	if not project or not erpnext_installed():
		return "full"
	user = user or frappe.session.user
	cache = getattr(frappe.local, "folio_project_cap", None)
	if cache is None:
		cache = frappe.local.folio_project_cap = {}
	key = (project, user)
	if key not in cache:
		if not frappe.db.exists("Project", project):
			cache[key] = "full"  # dangling link (project deleted): space rules only
		elif not frappe.has_permission("Project", "read", doc=project, user=user):
			cache[key] = None
		elif not frappe.has_permission("Project", "write", doc=project, user=user):
			cache[key] = "view"
		else:
			cache[key] = "full"
	return cache[key]


def cap(access: str | None, limit: str | None) -> str | None:
	"""The lower of two access levels (``None`` is lowest)."""
	if not access or not limit:
		return None
	return access if LEVELS[access] <= LEVELS[limit] else limit


def page_access(space: str, project: str | None, user: str | None = None) -> str | None:
	return cap(get_space_access(space, user), get_project_cap(project, user))


def get_page_access(page: str, user: str | None = None) -> str | None:
	row = frappe.db.get_value("Folio Page", page, ["space", "project"], as_dict=True)
	return page_access(row.space, row.project, user) if row else None


def check_page_access(page: str, required: str = "view") -> str:
	row = frappe.db.get_value("Folio Page", page, ["space", "project"], as_dict=True)
	if not row:
		frappe.throw(frappe._("Page {0} not found").format(page), frappe.DoesNotExistError)
	if row.project and not get_project_cap(row.project):
		frappe.throw(frappe._("You do not have access to this project in ERPNext"), frappe.PermissionError)
	access = page_access(row.space, row.project)
	if not has_level(access, required):
		if has_level(get_space_access(row.space), required):
			frappe.throw(frappe._("You can only view this project in ERPNext, so its pages are read-only"), frappe.PermissionError)
		frappe.throw(frappe._("You do not have access to this space"), frappe.PermissionError)
	return access


def filter_visible_pages(rows: list, user: str | None = None) -> list:
	"""Drop rows (with ``space`` and ``project``) the user can't see; sets ``row.access``."""
	visible = []
	for row in rows:
		access = page_access(row.space, row.get("project"), user)
		if access:
			row.access = access
			visible.append(row)
	return visible


def clear_access_cache():
	frappe.local.folio_space_access = {}
	frappe.local.folio_project_cap = {}
	frappe.local.folio_readable_projects = {}


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
	return has_level(page_access(doc.space, doc.get("project"), user), _required_for_page(ptype or "read"))


def version_has_permission(doc, ptype=None, user=None, debug=False):
	return has_level(get_page_access(doc.page, user), _required_for_page(ptype or "read"))


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


def _readable_projects_sql(user: str) -> str:
	"""SQL list of the Projects ``user`` may read (Frappe's own get_list rules)."""
	cache = getattr(frappe.local, "folio_readable_projects", None)
	if cache is None:
		cache = frappe.local.folio_readable_projects = {}
	if user not in cache:
		names = frappe.get_list("Project", pluck="name", limit=0, user=user) if frappe.has_permission(
			"Project", "read", user=user
		) else []
		cache[user] = ", ".join(frappe.db.escape(n) for n in names) or "''"
	return cache[user]


def _project_condition(table: str, user: str) -> str:
	if not erpnext_installed():
		return ""
	return (
		f" and (ifnull(`{table}`.project, '') = '' or `{table}`.project in ({_readable_projects_sql(user)})"
		f" or `{table}`.project not in (select name from `tabProject`))"
	)


def page_query_conditions(user=None):
	user = user or frappe.session.user
	if not is_folio_user(user):
		return "1=0"
	projects = _project_condition("tabFolio Page", user)
	if is_folio_manager(user):
		return projects[5:] if projects else ""  # managers: every space, but still ERPNext's project rules
	return f"`tabFolio Page`.space in ({_visible_spaces_sql(user)}){projects}"


def version_query_conditions(user=None):
	user = user or frappe.session.user
	if not is_folio_user(user):
		return "1=0"
	projects = _project_condition("tabFolio Page", user).replace("`tabFolio Page`.", "")
	spaces = "1=1" if is_folio_manager(user) else f"space in ({_visible_spaces_sql(user)})"
	return f"`tabFolio Page Version`.page in (select name from `tabFolio Page` where {spaces}{projects})"


def favorite_query_conditions(user=None):
	user = user or frappe.session.user
	if user == "Administrator":
		return ""
	return f"`tabFolio Favorite`.user = {frappe.db.escape(user)}"
