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

## Where ERPNext plugs in (current + planned)

- Now: `Folio Space.project` and `Folio Page.project` link fields; demo data creates
  projects/tasks; users are Frappe users (and HRMS employees in the demo).
- Next (phase 3): linked database views over Task/Project/Timesheet, task blocks that
  are real ERPNext Tasks, record mentions, a page per project, timesheet timer.
  Linked views must read through `frappe.get_list` so ERPNext's own permissions apply.

## Real-time (planned)

Frappe's socket.io server loads `<app>/realtime/handlers.js` from every installed app
(`apps/frappe/realtime/index.js`). Phase 4 uses that to relay Yjs updates for live
co-editing, with the session already authenticated by Frappe. The Yjs packages are
already installed (drag-handle peers).
