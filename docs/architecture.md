# Folio architecture

## Shape of the system

```
Browser (/folio, Vue SPA)                       Frappe site (same as ERPNext)
┌──────────────────────────────┐   REST        ┌───────────────────────────────────┐
│ Sidebar ── data/workspace.js │──────────────▶│ folio.api.workspace  (sidebar,    │
│ Page.vue ── autosave         │  /api/method  │                       search…)    │
│   Editor.vue (TipTap)        │──────────────▶│ folio.api.pages      (content,    │
│   slash menu, mentions,      │               │                       tree, trash)│
│   callout, page links        │               │ folio.api.spaces     (members)    │
└──────────────────────────────┘               │        │                          │
                                               │        ▼                          │
                                               │ folio.permissions (space access)  │
                                               │        │                          │
                                               │        ▼                          │
                                               │ DocTypes: Folio Space / Page /    │
                                               │ Page Version / Favorite           │
                                               │ + ERPNext: Project, Task, User…   │
                                               └───────────────────────────────────┘
```

The SPA is served by `folio/www/folio.py`, which renders `folio/www/folio.html`
(written by the Vite build) with boot data injected as `window.*`
(`csrf_token`, `site_name`, `socketio_port`). Everything under `/folio/*` routes to
the SPA (`website_route_rules` in `hooks.py`); Vue Router uses `createWebHistory('/folio')`.

## Access control

All rules live in `folio/permissions.py`:

| Who | Access to a space |
|---|---|
| Administrator, System Manager, Folio Manager | `full` everywhere |
| Explicit member | their row: `Full Access`→`full`, `Can Edit`→`edit`, `Can View`→`view` |
| Other desk users, space visibility `Workspace` | the space's `default_access` (`edit` or `view`) |
| Other desk users, visibility `Private` | none |
| Website users, Guest | none |

A page has its space's access. `edit` can create/edit/move/trash pages; `full` can also
change the space and its members. The same functions back:

- the API (`check_space_access`, `check_page_access`), and
- the desk (`has_permission` and `permission_query_conditions` hooks), so a private page
  can't be found through `/desk/folio-page` or `frappe.get_list` either.

Access is cached per request in `frappe.local.folio_space_access`; call
`clear_access_cache()` after changing members.

## Page content and saving

- Content is TipTap/ProseMirror JSON (`Folio Page.content`). The schema is whatever
  `frontend/src/components/editor/extensions.js` registers; that file is the single
  source of truth for block types.
- On every save the server derives `content_text` (`folio/utils.py: content_to_text`)
  for search. If you add a node type that carries text in attrs (like `pageLink`),
  teach `content_to_text` about it.
- The client autosaves 700 ms after the last change (`Page.vue`). It sends
  `base_version` = the `content_version` it last saw. If **another user** saved in
  between, the server refuses and returns the latest content (`conflict: true`); the
  client loads it and warns. Saves by the **same user** always win (two tabs).
  This is a stop-gap until real-time co-editing (roadmap phase 4).
- Versions: `maybe_snapshot()` updates the author's latest version if it is under
  10 minutes old, otherwise inserts a new one. Restoring a version snapshots the
  current state first, so a restore can be undone.

## Tree operations

- Order is `sort_order` (float) among siblings. `move_page(name, space, parent, index)`
  renumbers the destination siblings 1..n.
- Moving a page to another space moves its whole subtree (`FolioPage.on_update`).
- Cycles are blocked in `FolioPage.validate_parent` and `move_page`.
- Archive marks the subtree `is_archived`; restore puts the page back at top level if
  its parent is still in the trash; delete (trash only) removes the subtree, versions
  and favorites (`FolioPage.on_trash`).

## Frontend state

`src/data/workspace.js` holds the sidebar data as a **flat** page list plus spaces and
favorites. The tree is derived (`childrenOf`). Renames patch the one object
(`patchPage`), so the sidebar, breadcrumbs and page-link blocks update live. Structural
changes (move, archive, duplicate) just reload the sidebar — it's one cheap call.

## Where ERPNext plugs in

ERPNext is optional. `folio.api.tasks.erpnext_enabled()` decides; the SPA reads
`erpnext_installed` from `get_boot` and hides ERPNext-only slash commands
(`requires: 'erpnext'` in `slashCommands.js`).

**Task blocks** (`erpnextTask` node, `folio/api/tasks.py`, `TaskBlockView.vue`):

- The page stores only `{task, subject}`. Status, assignees, due date and project are
  read live via `get_tasks` (batched per tick in `src/data/tasks.js`, refreshed on
  window focus / tab visible). `subject` is a cache for search and loading states.
- Create: `create_task(page, subject)` puts the Task in the page's `project`, else the
  space's `project`. Link: `search_tasks` (via `frappe.get_list`), page-project first.
- Tick: `set_completed` sets `Completed` + `completed_on/by`, or back to `Open`.
  ERPNext's own validation runs (open dependencies block completion; completion
  closes assignments, so done tasks show `completed_by` instead of assignees).
- **Two permission checks:** Folio (edit the page to create; view it to read) *and*
  ERPNext (`Task` create/read/write via normal `insert`/`save`/`has_permission`, never
  `ignore_permissions`). Unreadable tasks render as "a task you don't have access to";
  deleted ones as "(deleted in ERPNext)".

**Project pages** (`folio/projects.py`, hooked via `doc_events["Project"]`):

- One page per Project (`is_project_page = 1`, `project` set), **always in the projects
  space** (Folio Settings → `projects_space`, else a "Projects" space made on first
  use). `move_page` refuses to move a project page to another space. Team spaces may
  still link a project (their `/task` defaults to it) but never host its page.
- The page body is only the project's **Overview** (free-form editor). `Page.vue` wraps
  project pages in `ProjectPage.vue`: live `ProjectHeader` (status switch via
  `projects.set_status`, progress, dates, priority, customer, team) and tabs
  **Overview** | **Tasks** (`?tab=tasks`). The editor stays mounted (`v-show`) so
  autosave/undo survive tab switches. One `useProject()` load feeds header and tabs.
- **One task list per project:** the Tasks tab lists the project's ERPNext Tasks.
  On a project page `/task` can only create or link tasks of *that* project
  (`tasks.locked_project`); `/project` is hidden (`hiddenOn: 'projectPage'`).
  Elsewhere `/project` inserts a read-only card (counts + "Open project page").
- `on_update`: a renamed project renames its page if the title still matched.
  `on_trash`: page to trash, links cleared; `ignore_links_on_delete` lets the delete through.
- Runs in a savepoint; any error is logged (Error Log) and never blocks ERPNext.
- **Tasks tab views** (`ProjectTasks.vue`; state in the URL: `?tab=tasks&view=board&group=assignee&task=TASK-…`):
  List (`TaskRow`), Board (`TaskBoard` + `TaskCard`), Table (`TaskTable`), and the
  side panel (`TaskPanel`). Edits go through `tasks.update_task` (allow-listed fields,
  ERPNext `save()` + permissions) and `tasks.set_assignees` (Frappe `assign_to`).
  - Board by **status**: Open · Working · Pending Review · Completed (+ Cancelled if
    any). ERPNext's daily job sets *Overdue*, so those cards sit in Open with a red
    flag; dropping sets a real status. By **assignee**: a card sits under its first
    assignee, dropping replaces the assignees (Unassigned clears them). By **priority**.
    No ordering inside a column: ERPNext tasks have no manual order.
  - Page.vue goes full width while a board/table is shown.
  - The panel caps dates at the project's end date (ERPNext rejects later ones) and
    shows ERPNext's own message if a save is refused, then reloads the server value.
- **Projects overview** (`pages/Projects.vue`, route `/projects`, linked from the projects
  space in the sidebar via `get_boot().projects_space`): `projects.list_projects` returns
  every readable Project with grouped task counts (one `get_list` with COUNT/group by),
  overdue (status Overdue, or late but not yet flagged), team (members + open
  assignees) and its page. Board drag calls `set_status`. `create_project` inserts the
  Project with ERPNext permissions; the hook makes its page.
- Backfill: Folio Settings → "Create pages for existing projects".
- Patch `v0_1.project_page_layout` migrated older pages (removed the embedded
  project block, moved pages into the projects space).

Still planned: record mentions, linked database views over Task/Project/Timesheet,
timesheet timer. Linked views must read through `frappe.get_list`.

## Real-time (planned)

Frappe's socket.io server loads `<app>/realtime/handlers.js` from every installed app
(`apps/frappe/realtime/index.js`). Phase 4 uses that to relay Yjs updates for live
co-editing, with the session already authenticated by Frappe. The Yjs packages are
already installed (drag-handle peers).
