// Copyright (c) 2026, Eagle Automate and contributors
// For license information, please see license.txt

frappe.ui.form.on("Folio Settings", {
	add_starter_pages(frm) {
		frappe.call({
			method: "folio.starter.add_starter_pages",
			freeze: true,
			callback: () => {
				frappe.show_alert({ message: __("Getting Started pages are in place"), indicator: "green" });
				frm.reload_doc();
			},
		});
	},
	create_missing_project_pages(frm) {
		frappe.call({
			method: "folio.projects.create_missing_project_pages",
			freeze: true,
			freeze_message: __("Creating project pages…"),
			callback: (r) => {
				const n = r.message?.created ?? 0;
				frappe.show_alert({ message: __("{0} project page(s) created", [n]), indicator: "green" });
			},
		});
	},
});
