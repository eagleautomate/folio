# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Serves the Folio single-page app at /folio (built from frontend/ into folio.html)."""

import frappe
from frappe import _

from folio.permissions import is_folio_user

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=" + frappe.request.path
		raise frappe.Redirect
	if not is_folio_user():
		frappe.throw(_("Folio is only available to desk users"), frappe.PermissionError)

	frappe.db.commit()
	context.boot = get_boot()
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	"""Used by the Vite dev server (``yarn dev``) to fetch the same boot data."""
	if not frappe.conf.developer_mode:
		frappe.throw(_("This method is only meant for developer mode"))
	return get_boot()


def get_boot():
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"site_name": frappe.local.site,
			"socketio_port": frappe.conf.socketio_port,
			"csrf_token": frappe.sessions.get_csrf_token(),
		}
	)
