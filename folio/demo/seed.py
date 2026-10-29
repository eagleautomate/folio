# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Demo data for trying Folio locally.

	bench --site folio.localhost execute folio.demo.seed.run
	bench --site folio.localhost execute folio.demo.seed.clear   # remove it again

Idempotent: re-running skips anything that already exists. Demo logins use the
reserved ``.test`` TLD (``anna.keller@folio.test`` …) with password ``admin12345!``.
Requires ERPNext for the projects/tasks part; without it only Folio data is created.
"""

import frappe
from frappe.utils import add_days, getdate, today

from folio.demo.content import (
	bullets,
	callout,
	code,
	doc,
	h,
	hr,
	mention,
	numbered,
	p,
	page_link,
	quote,
	table,
	text,
	todos,
)

DEMO_PASSWORD = "admin12345!"
COMPANY = "Folio Demo AG"
MARKER = "folio_demo_seeded"

PEOPLE = [
	# first, last, department, extra roles
	("Anna", "Keller", "Management", ["Folio Manager", "Projects Manager"]),
	("Luca", "Meier", "Engineering", ["Projects User"]),
	("Sophie", "Brunner", "Engineering", ["Projects User"]),
	("Marco", "Rossi", "Operations", ["Projects User"]),
	("Elena", "Weber", "Marketing", ["Projects User"]),
	("Jonas", "Huber", "Engineering", ["Projects User"]),
]


def email_for(first, last):
	return f"{first.lower()}.{last.lower()}@folio.test"


def run():
	frappe.set_user("Administrator")
	frappe.flags.in_demo_seed = True
	has_erpnext = "erpnext" in frappe.get_installed_apps()

	if has_erpnext:
		complete_setup()
	users = make_users()
	projects = make_projects_and_tasks(users) if has_erpnext else {}
	make_spaces_and_pages(users, projects)

	frappe.db.set_default(MARKER, "1")
	frappe.db.commit()
	print(f"Folio demo ready. Log in as {users['anna']} / {DEMO_PASSWORD} (or Administrator).")


# ---- ERPNext ------------------------------------------------------------------


def complete_setup():
	if frappe.is_setup_complete():
		return
	from frappe.desk.page.setup_wizard.setup_wizard import setup_complete

	year = getdate(today()).year
	setup_complete(
		{
			"language": "English",
			"country": "Switzerland",
			"timezone": "Europe/Zurich",
			"currency": "CHF",
			"full_name": "Folio Admin",
			"email": "admin@folio.test",
			"password": DEMO_PASSWORD,
			"company_name": COMPANY,
			"company_abbr": "FDA",
			"chart_of_accounts": "Standard",
			"fy_start_date": f"{year}-01-01",
			"fy_end_date": f"{year}-12-31",
			"setup_demo": 0,
			"enable_telemetry": 0,
		}
	)
	frappe.db.commit()
	print("ERPNext setup completed for", COMPANY)


def make_users():
	users = {}
	has_hr = frappe.db.exists("DocType", "Employee")
	company = frappe.db.get_value("Company", {}, "name") if has_hr else None
	for first, last, department, roles in PEOPLE:
		email = email_for(first, last)
		if not frappe.db.exists("User", email):
			user = frappe.get_doc(
				{
					"doctype": "User",
					"email": email,
					"first_name": first,
					"last_name": last,
					"send_welcome_email": 0,
					"user_type": "System User",
					"new_password": DEMO_PASSWORD,
				}
			)
			for role in ["Folio User", *roles]:
				if frappe.db.exists("Role", role):
					user.append("roles", {"role": role})
			user.insert(ignore_permissions=True)
		if company and not frappe.db.exists("Employee", {"user_id": email}):
			frappe.get_doc(
				{
					"doctype": "Employee",
					"first_name": first,
					"last_name": last,
					"gender": "Prefer not to say" if frappe.db.exists("Gender", "Prefer not to say") else None,
					"date_of_birth": "1990-05-12",
					"date_of_joining": "2024-02-01",
					"company": company,
					"status": "Active",
					"user_id": email,
					"company_email": email,
				}
			).insert(ignore_permissions=True, ignore_mandatory=True)
		users[first.lower()] = email
	return users


PROJECTS = [
	(
		"Website Relaunch",
		-20,
		40,
		[
			("Define sitemap and page inventory", "Completed", "luca"),
			("Design system: colours and type scale", "Completed", "sophie"),
			("Homepage wireframes", "Working", "sophie"),
			("Set up staging environment", "Working", "jonas"),
			("Migrate blog posts", "Open", "elena"),
			("SEO redirects map", "Open", "elena"),
			("Accessibility audit", "Open", "luca"),
			("Go-live checklist", "Open", "anna"),
		],
	),
	(
		"ERP Rollout Phase 2",
		-45,
		60,
		[
			("Map purchase approval workflow", "Completed", "marco"),
			("Import supplier master data", "Completed", "marco"),
			("Configure timesheet billing", "Working", "anna"),
			("Train warehouse team", "Open", "marco"),
			("Stock reconciliation dry run", "Open", "jonas"),
			("Sign-off with finance", "Open", "anna"),
		],
	),
	(
		"Mobile App MVP",
		-5,
		90,
		[
			("User interviews (5 customers)", "Working", "elena"),
			("Choose cross-platform stack", "Completed", "luca"),
			("Auth + login screens", "Open", "jonas"),
			("Offline sync spike", "Open", "luca"),
			("Push notifications", "Open", "sophie"),
		],
	),
]


def make_projects_and_tasks(users):
	from frappe.desk.form import assign_to

	company = frappe.db.get_value("Company", {}, "name")
	base = getdate(today())
	projects = {}
	for title, start, end, tasks in PROJECTS:
		name = frappe.db.get_value("Project", {"project_name": title})
		if not name:
			name = (
				frappe.get_doc(
					{
						"doctype": "Project",
						"project_name": title,
						"company": company,
						"status": "Open",
						"expected_start_date": add_days(base, start),
						"expected_end_date": add_days(base, end),
					}
				)
				.insert(ignore_permissions=True)
				.name
			)
		projects[title] = name

		for i, (subject, status, owner) in enumerate(tasks):
			if frappe.db.exists("Task", {"subject": subject, "project": name}):
				continue
			task = frappe.get_doc(
				{
					"doctype": "Task",
					"subject": subject,
					"project": name,
					"status": "Open",
					"priority": ["Low", "Medium", "High"][i % 3],
					"exp_start_date": add_days(base, start + i * 4),
					"exp_end_date": add_days(base, start + i * 4 + 6),
				}
			).insert(ignore_permissions=True)
			assign_to.add({"assign_to": [users[owner]], "doctype": "Task", "name": task.name, "notify": 0})
			if status != "Open":
				task.reload()
				task.status = status
				if status == "Completed":
					task.completed_on = add_days(base, -1)
					task.completed_by = users[owner]
				task.save(ignore_permissions=True)
	return projects


# ---- Folio --------------------------------------------------------------------


def get_or_create_space(title, icon, visibility="Workspace", members=(), project=None, description=None):
	name = frappe.db.get_value("Folio Space", {"title": title})
	if name:
		return name
	space = frappe.get_doc(
		{
			"doctype": "Folio Space",
			"title": title,
			"icon": icon,
			"visibility": visibility,
			"description": description,
			"project": project,
			"sort_order": frappe.db.count("Folio Space") + 1,
			"members": [{"user": u, "access": a} for u, a in members],
		}
	)
	space.insert(ignore_permissions=True)
	return space.name


def get_or_create_page(space, title, content=None, parent=None, icon=None, cover=None, owner=None):
	name = frappe.db.get_value(
		"Folio Page", {"space": space, "title": title, "parent_page": parent or ("is", "not set")}
	)
	if name:
		return name
	import json

	page = frappe.get_doc(
		{
			"doctype": "Folio Page",
			"space": space,
			"title": title,
			"parent_page": parent,
			"icon": icon,
			"cover": cover,
			"content": json.dumps(content) if content else None,
			"sort_order": frappe.db.count("Folio Page", {"space": space, "parent_page": parent or ("is", "not set")})
			+ 1,
		}
	)
	if owner:
		frappe.set_user(owner)
	try:
		page.insert(ignore_permissions=True)
	finally:
		frappe.set_user("Administrator")
	return page.name


GRADIENTS = {
	"sunrise": "linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)",
	"ocean": "linear-gradient(135deg, #a5f3fc 0%, #818cf8 100%)",
	"mint": "linear-gradient(135deg, #bbf7d0 0%, #22d3ee 100%)",
	"slate": "linear-gradient(135deg, #1e293b 0%, #475569 100%)",
}


def make_spaces_and_pages(users, projects):
	anna, luca, sophie, marco, elena, jonas = (users[k] for k in ["anna", "luca", "sophie", "marco", "elena", "jonas"])

	# -- Company wiki (everyone can edit)
	wiki = get_or_create_space(
		"Company Wiki", "🏢", description="Everything about how we work. Everyone can edit."
	)
	welcome = get_or_create_page(
		wiki,
		"Welcome to Folio",
		icon="👋",
		cover=GRADIENTS["sunrise"],
		owner=anna,
		content=doc(
			p(
				"Folio is our shared workspace for docs, notes and plans — built right into ERPNext, so pages live next to the projects, tasks and people they're about."
			),
			callout("💡", "Press ", text("/", "code"), " on an empty line to insert any block, or ", text("⌘K", "code"), " to search every page."),
			h(2, "What you can do"),
			bullets(
				[text("Write", "bold"), " with headings, lists, to-dos, quotes, code and tables"],
				[text("Organise", "bold"), " pages inside pages — drag them around in the sidebar"],
				[text("Mention", "bold"), " teammates with @, e.g. ", mention(luca, "Luca Meier")],
				[text("Star", "bold"), " the pages you use every day so they show up under Favorites"],
				[text("Go back in time", "bold"), " with version history from the ••• menu"],
			),
			h(2, "Try it"),
			todos(
				("Open this page's ••• menu and look at Version history", False),
				("Create a page in your team's space", False),
				("Drag a page in the sidebar to nest it under another one", False),
				("Read the welcome page", True),
			),
			h(2, "Keyboard shortcuts"),
			table(
				["Shortcut", "What it does"],
				["⌘K", "Search pages"],
				["/", "Insert a block"],
				["⌘B / ⌘I / ⌘U", "Bold, italic, underline"],
				["# + space", "Heading (## for smaller)"],
				["[] + space", "To-do item"],
				["``` + space", "Code block"],
			),
			quote("The best documentation is the one people actually keep up to date."),
		),
	)
	handbook = get_or_create_page(
		wiki,
		"Team Handbook",
		icon="📘",
		owner=anna,
		content=doc(
			p("How we work together, in one place. Each section below is its own page."),
			h(2, "Our values"),
			numbered(
				"Default to open: write things down where others can find them.",
				"Small steps, verified: ship in increments and check each one.",
				"Own the outcome, not just the task.",
			),
			h(2, "Working hours"),
			p("Core hours are 10:00–16:00 CET. Log your time daily in ERPNext Timesheets."),
		),
	)
	get_or_create_page(
		wiki,
		"Onboarding checklist",
		parent=handbook,
		icon="✅",
		owner=anna,
		content=doc(
			p("For every new teammate. Your buddy will walk you through it in week one."),
			h(3, "Day 1"),
			todos(("Laptop and accounts set up", True), ("ERPNext login works", True), ("Meet your buddy", False)),
			h(3, "Week 1"),
			todos(
				("Read the Team Handbook", False),
				("Shadow one customer call", False),
				("Ship one small change", False),
			),
		),
	)
	get_or_create_page(
		wiki,
		"Expense policy",
		parent=handbook,
		icon="🧾",
		owner=marco,
		content=doc(
			callout("⚠️", "Submit expenses within 30 days, with a receipt attached in ERPNext."),
			table(["Category", "Limit (CHF)", "Approval"], ["Meals", "60 / day", "None"], ["Travel", "Actual cost", "Manager"], ["Equipment", "500", "Manager + Finance"]),
		),
	)
	get_or_create_page(
		wiki,
		"Weekly all-hands — notes",
		icon="🗓️",
		owner=elena,
		content=doc(
			p(text("Attendees: ", "bold"), mention(anna, "Anna Keller"), " ", mention(elena, "Elena Weber"), " ", mention(marco, "Marco Rossi")),
			h(2, "Updates"),
			bullets(
				"Website relaunch is on track for the staging review next week.",
				"ERP Phase 2: supplier import done; warehouse training being scheduled.",
				"Mobile app: 3 of 5 customer interviews completed.",
			),
			h(2, "Action items"),
			todos(
				([mention(marco, "Marco Rossi"), " book warehouse training slots"], False),
				([mention(elena, "Elena Weber"), " share interview summary"], False),
				([mention(anna, "Anna Keller"), " confirm go-live date with finance"], True),
			),
		),
	)

	# -- Engineering (workspace-visible, explicit members)
	eng = get_or_create_space(
		"Engineering",
		"🛠️",
		members=[(luca, "Full Access"), (sophie, "Can Edit"), (jonas, "Can Edit")],
		description="Architecture, runbooks and decisions.",
	)
	arch = get_or_create_page(
		eng,
		"Architecture overview",
		icon="🧱",
		cover=GRADIENTS["slate"],
		owner=luca,
		content=doc(
			p("A short tour of how our systems fit together."),
			h(2, "Stack"),
			table(
				["Layer", "Technology", "Owner"],
				["ERP", "Frappe + ERPNext v16", "Luca"],
				["Website", "Static site + headless CMS", "Sophie"],
				["Mobile", "To be decided (see decision log)", "Jonas"],
			),
			h(2, "Calling the ERPNext API"),
			code(
				'import requests\n\nr = requests.get(\n    "https://erp.example.com/api/resource/Task",\n    params={"filters": \'[["status","=","Open"]]\'},\n    headers={"Authorization": "token <key>:<secret>"},\n)\nprint(r.json()["data"])',
				"python",
			),
			callout("🔐", "Never commit API keys. Use the team vault."),
		),
	)
	get_or_create_page(
		eng,
		"Decision log",
		parent=arch,
		icon="🧭",
		owner=luca,
		content=doc(
			h(3, "2026-10-12 — Mobile stack"),
			p(text("Decision: ", "bold"), "Prototype with a cross-platform framework first; revisit after the offline-sync spike."),
			h(3, "2026-09-30 — Staging environment"),
			p(text("Decision: ", "bold"), "One shared staging bench, reset weekly from production backups."),
		),
	)
	runbook = get_or_create_page(
		eng,
		"Runbook: deploy to production",
		icon="🚀",
		owner=jonas,
		content=doc(
			numbered("Announce the deploy in the team channel.", "Run the backup.", "Pull and migrate.", "Smoke-test login, a sales order and a timesheet."),
			code("bench --site erp.example.com backup --with-files\nbench update --pull\nbench --site erp.example.com migrate\nbench restart", "bash"),
			callout("🧯", "If migrate fails: restore the backup, then open an incident page in this space."),
		),
	)
	sprint = get_or_create_page(
		eng,
		"Sprint 42 planning",
		icon="🏃",
		owner=sophie,
		content=doc(
			p("Goal: staging for the website relaunch, and the first mobile login screen."),
			todos(
				("Homepage wireframes signed off", True),
				("Staging environment reachable over VPN", False),
				("Auth screens prototype", False),
				("Accessibility audit kickoff", False),
			),
			p("Related: ", text("Runbook", "italic")),
			page_link(runbook, "Runbook: deploy to production"),
		),
	)

	# -- Project space linked to an ERPNext project
	launch = get_or_create_space(
		"Website Relaunch",
		"🌐",
		project=projects.get("Website Relaunch"),
		members=[(sophie, "Full Access"), (elena, "Can Edit"), (luca, "Can Edit")],
		description="Everything for the relaunch project.",
	)
	brief = get_or_create_page(
		launch,
		"Project brief",
		icon="🎯",
		cover=GRADIENTS["ocean"],
		owner=sophie,
		content=doc(
			h(2, "Why"),
			p("Our site is slow, hard to update and doesn't reflect what we sell today."),
			h(2, "Success looks like"),
			bullets("Page load under 1.5s on mobile", "Marketing can publish without engineering", "+20% demo requests within 3 months"),
			h(2, "Timeline"),
			table(["Milestone", "Date"], ["Wireframes", "Week 2"], ["Staging review", "Week 5"], ["Go-live", "Week 8"]),
		),
	)
	get_or_create_page(
		launch,
		"Content migration plan",
		parent=brief,
		icon="📦",
		owner=elena,
		content=doc(
			p("Which pages we keep, merge or drop."),
			table(["Section", "Pages", "Action"], ["Blog", "48", "Keep, re-tag"], ["Products", "12", "Rewrite"], ["Legacy news", "30", "Drop + redirect"]),
		),
	)
	get_or_create_page(
		launch,
		"Launch checklist",
		icon="📋",
		owner=sophie,
		content=doc(
			todos(
				("DNS TTL lowered 48h before", False),
				("Redirect map uploaded", False),
				("Analytics + consent banner verified", False),
				("Rollback plan written", False),
			)
		),
	)

	# -- Private leadership space
	leadership = get_or_create_space(
		"Leadership",
		"🔒",
		visibility="Private",
		members=[(anna, "Full Access"), (marco, "Can View")],
		description="Private to the leadership team.",
	)
	get_or_create_page(
		leadership,
		"Q4 goals",
		icon="🏆",
		owner=anna,
		content=doc(
			callout("🔒", "Only members of the Leadership space can see this page."),
			h(2, "Objectives"),
			numbered("Finish ERP Phase 2 by mid-December", "Relaunch the website", "Ship a mobile MVP to 3 pilot customers"),
			h(2, "Hiring"),
			bullets("1 × Frappe developer", "1 × Customer success"),
		),
	)

	for user, page in [(anna, welcome), (luca, arch), (sophie, sprint), (elena, brief)]:
		if not frappe.db.exists("Folio Favorite", {"user": user, "page": page}):
			frappe.get_doc({"doctype": "Folio Favorite", "user": user, "page": page, "sort_order": 1}).insert(
				ignore_permissions=True
			)
	if not frappe.db.exists("Folio Favorite", {"user": "Administrator", "page": welcome}):
		frappe.get_doc({"doctype": "Folio Favorite", "user": "Administrator", "page": welcome, "sort_order": 1}).insert(
			ignore_permissions=True
		)


def clear():
	"""Remove the Folio demo spaces/pages and demo users. ERPNext projects/tasks are kept."""
	frappe.set_user("Administrator")
	for space in frappe.get_all(
		"Folio Space", filters={"title": ["in", ["Company Wiki", "Engineering", "Website Relaunch", "Leadership"]]}, pluck="name"
	):
		frappe.delete_doc("Folio Space", space, ignore_permissions=True, force=True)
	frappe.db.delete("Folio Favorite", {"user": ["like", "%@folio.test"]})
	frappe.db.set_default(MARKER, None)
	frappe.db.commit()
	print("Folio demo spaces and pages removed. Demo users and ERPNext records were left in place.")
