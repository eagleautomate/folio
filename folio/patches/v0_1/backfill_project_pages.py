# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Sites that installed Folio before this patch: give projects that existed before the
install their pages (new projects already get one from the Project hook)."""

from folio.install import backfill_project_pages_if_enabled, ensure_settings


def execute():
	ensure_settings()
	backfill_project_pages_if_enabled()
