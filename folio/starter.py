# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""The "Getting Started" space: starter pages that teach Folio, like Notion's.

Created once per site: on install, and by a patch for sites installed earlier. It is
readable by everyone and editable by Folio Managers, so nobody breaks it by accident.
If a manager deletes it, it stays deleted; Folio Settings can add it back.
"""

import json

import frappe

from folio.utils import next_sort_order
from folio.content import bullets, callout, code, doc, h, hr, numbered, p, page_link, quote, table, text, todos

SPACE_TITLE = "Getting Started"


def erpnext_installed() -> bool:
	return "erpnext" in frappe.get_installed_apps()


def create_starter_pages(force: bool = False) -> str | None:
	"""Create the Getting Started space and its pages. Returns the space name.

	Skips when it was created before (and possibly deleted on purpose) unless ``force``.
	Missing pages are added again; existing ones are left alone.
	"""
	if not force and frappe.db.get_single_value("Folio Settings", "starter_pages_created"):
		return None

	space = frappe.db.get_value("Folio Space", {"title": SPACE_TITLE})
	if not space:
		first = frappe.get_all("Folio Space", order_by="sort_order asc", limit=1, pluck="sort_order")
		space = (
			frappe.get_doc(
				{
					"doctype": "Folio Space",
					"title": SPACE_TITLE,
					"icon": "📖",
					"visibility": "Workspace",
					"default_access": "Can View",  # everyone reads; Folio Managers edit
					"description": "How to use Folio. Read-only for everyone; Folio Managers can edit or remove it.",
					"sort_order": (first[0] - 1) if first else 0,  # top of the sidebar
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	pages = {}

	def page(key, title, icon, parent=None):
		name = frappe.db.get_value(
			"Folio Page", {"space": space, "title": title, "parent_page": parent or ("is", "not set")}
		)
		if name:
			pages[key] = (name, False)
			return name
		new = frappe.get_doc(
			{
				"doctype": "Folio Page",
				"space": space,
				"parent_page": parent,
				"title": title,
				"icon": icon,
				"sort_order": next_sort_order(
					"Folio Page", {"space": space, "parent_page": parent or ("is", "not set")}
				),
			}
		).insert(ignore_permissions=True)
		pages[key] = (new.name, True)
		return new.name

	# create first, so pages can link to each other
	welcome = page("welcome", "Welcome to Folio", "👋")
	writing = page("writing", "Writing pages", "✍️")
	organising = page("organising", "Organising your work", "🗂️")
	projects = page("projects", "Projects & tasks", "📁") if erpnext_installed() else None
	access = page("access", "Who sees what", "🔐")
	templates = page("templates", "Templates", "🧩")
	meeting = page("meeting", "Meeting notes", "🗓️", parent=templates)
	brief = page("brief", "Project brief", "🎯", parent=templates)
	weekly = page("weekly", "Weekly plan", "📅", parent=templates)

	links = {
		"writing": page_link(writing, "Writing pages"),
		"organising": page_link(organising, "Organising your work"),
		"projects": page_link(projects, "Projects & tasks") if projects else None,
		"access": page_link(access, "Who sees what"),
		"templates": page_link(templates, "Templates"),
		"meeting": page_link(meeting, "Meeting notes"),
		"brief": page_link(brief, "Project brief"),
		"weekly": page_link(weekly, "Weekly plan"),
	}

	content = {
		"welcome": welcome_page(links),
		"writing": writing_page(),
		"organising": organising_page(),
		"projects": projects_page() if projects else None,
		"access": access_page(),
		"templates": templates_page(links),
		"meeting": meeting_template(),
		"brief": brief_template(),
		"weekly": weekly_template(),
	}
	for key, (name, is_new) in pages.items():
		if is_new and content.get(key):
			page_doc = frappe.get_doc("Folio Page", name)
			page_doc.content = json.dumps(content[key])
			page_doc.save(ignore_permissions=True)

	frappe.db.set_single_value("Folio Settings", "starter_pages_created", 1)
	return space


@frappe.whitelist(methods=["POST"])
def add_starter_pages() -> dict:
	"""Folio Settings button: add the Getting Started space (or its missing pages) again."""
	frappe.only_for(["System Manager", "Folio Manager"])
	return {"space": create_starter_pages(force=True)}


# ---- page content ---------------------------------------------------------------------


def welcome_page(links):
	tour = [links["writing"], links["organising"]]
	if links["projects"]:
		tour.append(links["projects"])
	tour += [links["access"], links["templates"]]
	return doc(
		p(
			"Folio is where your team writes things down: notes, plans, how-tos and project pages. "
			"It lives inside your Frappe site, so you log in once and the people, projects and tasks "
			"are the same ones you already know."
		),
		callout("💡", "New here? Read this page, then try the 5-minute tour below. Nothing you do can break it."),
		h(2, "How Folio is organised"),
		bullets(
			[text("Spaces", "bold"), " are like rooms: Company Wiki, Engineering, Leadership. You'll see them in the sidebar."],
			[text("Pages", "bold"), " live in a space. A page can hold other pages, like folders hold files."],
			[text("Blocks", "bold"), " are what a page is made of: paragraphs, headings, checklists, tables, images and more."],
		),
		h(2, "The 5-minute tour"),
		numbered(
			["Press ", text("⌘K", "code"), " (Ctrl+K on Windows) and search for anything."],
			"Open a space in the sidebar and click + to make your first page.",
			["On an empty line, type ", text("/", "code"), " to see every kind of block."],
			"Star a page you'll use often. It appears under Favorites.",
			"Drag a page in the sidebar onto another one to put it inside.",
		),
		h(2, "Guides"),
		*tour,
		hr(),
		quote(
			"A good rule: if you've explained something twice, write a page about it and share the link instead."
		),
	)


def writing_page():
	return doc(
		p("Everything on this page is made with blocks. Here's how to make each one."),
		h(2, "The / menu"),
		p(
			"On an empty line, type ",
			text("/", "code"),
			" and a menu opens. Keep typing to filter: ",
			text("/todo", "code"),
			", ",
			text("/table", "code"),
			", ",
			text("/code", "code"),
			". Press Enter to insert.",
		),
		h(2, "Shortcuts while you type"),
		table(
			["Type this…", "…to get"],
			["# and a space", "A big heading (## and ### for smaller ones)"],
			["- and a space", "A bulleted list"],
			["1. and a space", "A numbered list"],
			["[] and a space", "A checklist item"],
			["> and a space", "A quote"],
			["``` and a space", "A code block"],
			["--- ", "A divider line"],
			["@ and a name", "Mention a teammate"],
		),
		h(2, "Formatting"),
		p(
			"Select some text and a small toolbar appears. Make it ",
			text("bold", "bold"),
			", ",
			text("italic", "italic"),
			", ",
			text("highlighted", "highlight"),
			", ",
			text("inline code", "code"),
			", or turn it into a link. The first button turns the whole line into a heading, list or quote.",
		),
		h(2, "Blocks worth knowing"),
		callout("💡", "A callout like this one makes something stand out. Click the emoji to change it."),
		todos(("A checklist item", True), ("Another one, not done yet", False)),
		code("Code keeps its spacing\nand gets colours for many languages.", "python"),
		p(
			"Images: paste or drag a picture straight onto the page. Tables: ",
			text("/table", "code"),
			". Sub-pages: ",
			text("/page", "code"),
			" creates a page inside this one and links to it.",
		),
		h(2, "Moving blocks"),
		p("Hover over a block and grab the ⠿ handle on its left to drag it up or down."),
		h(2, "Saving"),
		p(
			"There's no Save button: Folio saves as you type. If someone else changes the same page at the "
			"same time, Folio loads their version and tells you, so nobody's work is overwritten. "
			"Made a mistake? Open the page's ••• menu, then Version history."
		),
	)


def organising_page():
	return doc(
		h(2, "Spaces"),
		p(
			"Each team gets a space. A space is open to everyone or private to its members, and each member "
			"can have Full Access, Can Edit or Can View. Use ••• next to a space in the sidebar for its "
			"settings and members."
		),
		h(2, "Pages inside pages"),
		p(
			"Hover a page in the sidebar and click + to add a page inside it. Drag pages to reorder them, "
			"or drop one onto another to nest it."
		),
		h(2, "Finding things"),
		bullets(
			[text("⌘K", "code"), " searches the titles and text of every page you can see."],
			"Favorites (★ on a page) stay at the top of the sidebar.",
			"Home shows the pages you edited most recently.",
		),
		h(2, "Copying a page"),
		p(
			"The ••• menu of a page (top right, or next to it in the sidebar) has Duplicate (a copy right "
			"below it) and Copy to… (a copy in another space you can edit). Templates work this way."
		),
		h(2, "Deleting and getting it back"),
		p(
			"Move to trash hides a page and everything inside it. Open Trash in the sidebar to restore it, "
			"or to delete it for good."
		),
		h(2, "Locking a page"),
		p(
			"A finished policy or a signed-off plan? Lock it from the page's ••• menu. "
			"It becomes read-only until someone unlocks it."
		),
	)


def projects_page():
	return doc(
		p(
			"Every project in ERPNext has a page in the Projects space. It isn't a copy: the status, dates, "
			"progress and tasks you see are the real ERPNext records, and changes go straight back to ERPNext."
		),
		h(2, "A project's page"),
		bullets(
			[text("The header", "bold"), " shows status, progress, dates, priority, customer and team. Click the status to change it."],
			[text("Overview", "bold"), " is for notes: goals, decisions, links."],
			[text("Tasks", "bold"), " is the project's task list."],
		),
		h(2, "Working with tasks"),
		table(
			["View", "Good for"],
			["List", "Adding tasks quickly: type and press Enter"],
			["Board", "Stand-ups: drag cards between columns (by status, person or priority)"],
			["Table", "Sorting by due date, priority or who's doing it"],
		),
		p("Click any task to open its panel and change the title, status, people, dates or description."),
		callout(
			"🚩",
			"A red flag means the task is past its due date. ERPNext marks a project Completed by itself once all its tasks are done.",
		),
		h(2, "Tasks and projects in any page"),
		bullets(
			[text("/task", "code"), " adds a task to a page. On a project's page it always belongs to that project."],
			[text("/project", "code"), " adds a live card of a project to meeting notes or a wiki page."],
		),
		h(2, "All projects"),
		p(
			"Projects in the sidebar opens a list of every project you can see, as a table or a board, with "
			"\"My projects\" and New project."
		),
	)


def access_page():
	return doc(
		p("Folio uses your Frappe users and roles. There's no separate account or password."),
		h(2, "Spaces"),
		table(
			["Access", "What it allows"],
			["Full Access", "Everything, including the space's settings and members"],
			["Can Edit", "Write, move and delete pages"],
			["Can View", "Read only"],
		),
		p(
			"A space is either open to everyone in the company or private to its members. "
			"Folio Managers can open every space."
		),
		callout("🔒", "Example: a private Leadership space. Members see it; everyone else doesn't even know it exists."),
		h(2, "Projects"),
		p(
			"A project's page follows ERPNext. If ERPNext doesn't let someone see a project, they won't see its "
			"page in Folio either. If they can only view it, the page is read-only."
		),
		callout(
			"🧑‍💼",
			"Example: a freelancer should only see one project. An admin adds a User Permission in ERPNext "
			"(Allow: Project, For Value: that project). Folio follows it automatically.",
		),
		p("Admins: the full guide is docs/admin.md in the Folio repository."),
	)


def templates_page(links):
	return doc(
		p("Ready-made pages to start from. To use one:"),
		numbered(
			"Open the template (links below).",
			"Click ••• at the top right of the page, then Copy to…, and pick your space.",
			"Rename the copy and fill it in. The template stays as it was.",
		),
		links["meeting"],
		links["brief"],
		links["weekly"],
	)


def meeting_template():
	return doc(
		p(text("Date: ", "bold"), "…   ", text("Attendees: ", "bold"), "type @ to add people"),
		h(2, "Agenda"),
		numbered("…", "…"),
		h(2, "Notes"),
		p("…"),
		h(2, "Decisions"),
		bullets("…"),
		h(2, "Action items"),
		todos(("Who does what, by when", False)),
	)


def brief_template():
	return doc(
		callout("🎯", "One sentence: what does success look like?"),
		h(2, "Why"),
		p("What problem are we solving, and for whom?"),
		h(2, "Scope"),
		table(["In scope", "Out of scope"], ["…", "…"]),
		h(2, "Milestones"),
		table(["Milestone", "Date", "Owner"], ["…", "…", "…"]),
		h(2, "Risks"),
		bullets("…"),
	)


def weekly_template():
	return doc(
		h(2, "Top 3 this week"),
		todos(("…", False), ("…", False), ("…", False)),
		h(2, "Waiting on"),
		bullets("…"),
		h(2, "Wins from last week"),
		bullets("…"),
	)
