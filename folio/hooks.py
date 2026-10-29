app_name = "folio"
app_title = "Folio"
app_publisher = "Eagle Automate"
app_description = "Notion-style workspace for pages, docs and databases, built natively on Frappe and ERPNext"
app_email = "mn@eagleautomation.in"
app_license = "mit"

required_apps = ["frappe"]

# Apps screen tile (/apps) and desk app switcher
add_to_apps_screen = [
	{
		"name": "folio",
		"logo": "/assets/folio/images/folio-logo.svg",
		"title": "Folio",
		"route": "/folio",
		"has_permission": "folio.permissions.is_folio_user",
	}
]

# The SPA owns everything under /folio (see folio/www/folio.py + frontend/)
website_route_rules = [
	{"from_route": "/folio/<path:app_path>", "to_route": "folio"},
]

before_install = "folio.install.before_install"
after_install = "folio.install.after_install"
after_migrate = "folio.install.after_migrate"

# Space-based access control, shared by the desk and the Folio API
has_permission = {
	"Folio Space": "folio.permissions.space_has_permission",
	"Folio Page": "folio.permissions.page_has_permission",
	"Folio Page Version": "folio.permissions.version_has_permission",
}

permission_query_conditions = {
	"Folio Space": "folio.permissions.space_query_conditions",
	"Folio Page": "folio.permissions.page_query_conditions",
	"Folio Page Version": "folio.permissions.version_query_conditions",
	"Folio Favorite": "folio.permissions.favorite_query_conditions",
}

# ERPNext (events never fire when ERPNext isn't installed)
doc_events = {
	"Project": {
		"after_insert": "folio.projects.on_project_insert",
		"on_update": "folio.projects.on_project_update",
		"on_trash": "folio.projects.on_project_trash",
	},
}

# A project's Folio page must not block deleting the project; on_trash clears the links
ignore_links_on_delete = ["Folio Page", "Folio Space"]
