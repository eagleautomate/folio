# AGENTS.md — working on Folio

Folio is a Notion/AppFlowy-style workspace (pages, docs, later databases) built as a
**native Frappe app**. It runs inside the same site as ERPNext so pages can link to
Projects, Tasks, Timesheets and Users directly, with the same login and permissions.

Read this file first, then `docs/architecture.md`. `docs/features.md` lists what users
can do today; `docs/admin.md` covers setting it up and controlling access; `docs/roadmap.md` says what is done and what is next; `docs/decisions.md`
says why things are the way they are.

## Ground rules

- **Small steps, each verified.** After any change: backend tests, frontend build,
  and (for UI changes) the browser smoke test. Don't stack unverified changes.
- **Never run tests on `folio.localhost`.** It holds the demo data. Tests run on
  `folio-test.localhost` (frappe + folio only).
- Match the surrounding code: tabs in Python, 2 spaces in JS/Vue, frappe-ui
  components and design tokens (`text-ink-gray-*`, `bg-surface-*`,
  `border-outline-*`) rather than raw Tailwind colours.
- Every whitelisted endpoint checks access itself through `folio/permissions.py`
  and then uses `ignore_permissions=True`. Don't call `frappe.get_list` and hope.
- Don't commit build output (`folio/public/frontend`, `folio/www/folio.html`).

## Layout

```
folio/                           Python package (the Frappe app)
  hooks.py                       routes, install hooks, permission hooks, Project doc_events
  permissions.py                 ALL access rules: spaces + ERPNext Project cap, desk hooks
  projects.py                    Project doc_events: auto project pages, rename, trash, backfill
  starter.py                     Getting Started space: guide + template pages (once per site)
  content.py                     ProseMirror JSON builders (page templates, demo, tests)
  utils.py                       ProseMirror JSON -> text, snippets, sort helpers
  install.py                     roles "Folio Manager" / "Folio User", Folio Settings defaults
  patches.txt, patches/v0_1/     data migrations (project page layout, sub-page project links)
  api/
    workspace.py                 get_boot, get_sidebar, search, get_recent, get_users
    pages.py                     page CRUD, save_content (conflict check), move, trash, versions, favorites
    spaces.py                    space CRUD, settings, members, delete
    tasks.py                     ERPNext tasks: blocks, create/link/tick, update_task, set_assignees
    projects.py                  ERPNext projects: get_project, list_projects, create_project, set_status
  folio/doctype/                 Folio Space (+ Member), Folio Page, Folio Page Version,
                                 Folio Favorite, Folio Settings (single)
  www/folio.py                   serves the SPA at /folio (boot data, login redirect)
  demo/seed.py                   demo data (run / clear)
  tests/                         test_folio (spaces, pages, access), test_tasks, test_projects,
                                 test_project_access (ERPNext permission cap)
frontend/                        Vue 3 + frappe-ui + TipTap SPA (Vite), eslint.config.js
  src/router.js                  /, /p/:name (page), /projects (overview)
  src/data/                      workspace.js (sidebar store), tasks.js (task cache + edits),
                                 project.js (useProject: live project for a project page)
  src/pages/                     Home, Page (autosave, conflicts, project wrapper), Projects (overview)
  src/components/                Sidebar + PageTreeItem (tree, drag & drop), SearchDialog,
                                 TrashDialog, NewSpaceDialog, SpaceSettingsDialog, VersionHistory,
                                 EmojiPicker
  src/components/editor/         Editor, extensions.js (the schema), slash menu, formatting menu,
                                 blocks: callout, pageLink, taskBlock, projectBlock (+ *View.vue),
                                 TaskRow, mentions, editor.css
  src/components/project/        ProjectPage (tabs), ProjectHeader, ProjectTasks (List/Board/Table),
                                 TaskBoard, TaskCard, TaskTable, TaskCheck, TaskPanel, NewProjectDialog
  src/utils/                     dates, debounce, upload (+ *.test.js unit tests)
  e2e/                           Puppeteer browser tests (see Commands)
docs/                            features (for users), admin (running it), architecture,
                                 roadmap, decisions
```

## Local environment

- Bench: `~/Desktop/frappe-bench` (Frappe v16, ERPNext v16, HRMS v16).
- Demo site: `folio.localhost`, served on **http://localhost:8008/folio**
  (Procfile line `web_folio`). Admin: `Administrator` / `admin`.
- Demo users (password `admin12345!`): `anna.keller@folio.test` (Folio Manager),
  `luca.meier`, `sophie.brunner`, `marco.rossi`, `elena.weber`, `jonas.huber` — all `@folio.test`.
- Test sites (`allow_tests` on): `folio-test.localhost` (frappe + folio) and
  `folio-erp-test.localhost` (frappe + erpnext + folio, for task-block tests).
  ERPNext tests skip themselves on the plain site; run the suite on both.

## Commands

```bash
cd ~/Desktop/frappe-bench && export PATH="$PWD/env/bin:$PATH"

bench start                                                     # all processes
bench --site folio-test.localhost run-tests --app folio --skip-before-tests
bench --site folio-erp-test.localhost run-tests --app folio --skip-before-tests
cd apps/folio/frontend && yarn build                            # or: bench build --app folio
cd apps/folio/frontend && yarn dev                              # Vite dev server, proxies to the bench
cd apps/folio/frontend && yarn test                             # vitest unit tests
cd apps/folio/frontend && yarn e2e                              # browser smoke test (needs bench running + demo data)
cd apps/folio/frontend && node e2e/tasks.mjs e2e/shots          # ERPNext task-block browser test
cd apps/folio/frontend && node e2e/projects.mjs e2e/shots       # project pages browser test
cd apps/folio/frontend && node e2e/board.mjs e2e/shots          # board / table / task panel browser test
cd apps/folio/frontend && node e2e/overview.mjs e2e/shots       # projects overview browser test
cd apps/folio/frontend && node e2e/sidebar.mjs e2e/shots        # finished projects leave the sidebar
cd apps/folio/frontend && node e2e/spaces.mjs e2e/shots         # space settings dialog
cd apps/folio/frontend && node e2e/access.mjs e2e/shots         # project pages follow ERPNext permissions (real users)
cd apps/folio/frontend && node e2e/menus.mjs e2e/shots          # sidebar ⋯ menus open next to their row
cd apps/folio/frontend && node e2e/starter.mjs e2e/shots        # Getting Started pages + Copy to…
cd apps/folio/frontend && yarn lint                             # ESLint (Vue + JS)
cd apps/folio/frontend && node e2e/screenshots.mjs ../docs/screenshots  # refresh README screenshots (cleans up after itself)

bench --site folio.localhost execute folio.demo.seed.run        # demo data (idempotent)
bench --site folio.localhost execute folio.demo.seed.clear      # remove demo spaces/pages
bench --site folio.localhost migrate                            # after changing DocType JSON
```

`--skip-before-tests` matters: Frappe's default `before_tests` would run a setup
wizard on the test site.

## Data model in one paragraph

A **Folio Space** is a teamspace with a visibility (`Workspace` = all desk users,
`Private` = members only), a `default_access` for non-members, and a member table
(`Full Access` / `Can Edit` / `Can View`). A **Folio Page** belongs to exactly one
space, has an optional `parent_page` (tree, ordered by `sort_order`), and stores its
body as **TipTap/ProseMirror JSON** in `content` plus a plain-text copy in
`content_text` for search. `content_version` increases on each content save and is
how concurrent edits are detected. **Folio Page Version** keeps snapshots (at most one
per author per 10 minutes). **Folio Favorite** is per user. Archiving moves a page and
its subtree to the trash; deleting is only allowed from the trash.

## Frappe v16 gotchas seen in this app

- `frappe.local` has no `__dict__`; use `getattr(frappe.local, "x", None)`.
- Raw SQL functions in field strings are rejected (`"max(sort_order)"`): use
  `order_by=... limit=1` or dict syntax.
- A user with no roles is silently a *Website User*. Give test/demo users a desk
  role (`Folio User`) or `is_folio_user()` correctly rejects them.
- `frappe.desk.form.assign_to.add()` takes no `ignore_permissions` kwarg.
- Anything that must exist on first use (projects space, project pages) must also be
  created on install / by a patch for sites installed earlier; don't rely on hooks that
  only fire for new records.
- ERPNext gives **Desk User** read on Project only at permlevel 1 (fields), so plain
  desk users can't open Projects; Projects User / Projects Manager can.
- frappe-ui `createResource({ auto: true })` re-throws fetch errors as unhandled
  rejections even with `onError`; for loads that may be refused, call
  `resource.fetch().catch(() => {})` yourself (see `Page.vue`).
- `frappe.client.get_list` ignores `pluck` (returns `[{ name }]`).
- ERPNext's Task permissions are on **Projects User** only; Projects Manager alone
  cannot create Tasks. Demo/test users that create tasks need Projects User.
- A Single DocType's field defaults aren't stored until saved; `install.ensure_settings`
  writes Folio Settings defaults on install/migrate.
- `patches.txt` (like `apps.txt`) may lack a trailing newline: appending with `>>`
  glues your patch onto the last comment and it silently never runs.
- ERPNext's `Project.validate` recomputes status from tasks (unless % complete is
  Manual): saving `status = "Completed"` with open tasks silently becomes "Open". Check
  the saved value; don't assume a save kept what you set.
- Date filters treat NULL as `0001-01-01` (`ifnull(...)`): `["<", today()]` matches
  rows with no date. Add `["field", "is", "set"]` (list-form filters) when that matters.
- `bench execute` hides import errors as `NameError: name 'folio' is not defined`;
  run the same call through `bench console` to see the real traceback.
- Datetimes are naive, in the system timezone (Europe/Zurich here). The SPA syncs
  its clock from `server_now` in `get_boot`; use `timeAgo()` / `clock.offset`.

## Frontend gotchas

- frappe-ui here uses **v2 design tokens**. A class with an old name renders
  *nothing*, with no build error. Use `bg-surface-base` (not `surface-white`),
  `bg-surface-elevation-2` for popups/menus (not `surface-modal`),
  `bg-surface-sidebar` (not `surface-menu-bar`). Outline tokens are for borders/rings
  only, never `bg-outline-*`. After a build, this lists any dead token class:
  ```bash
  css=$(cat folio/public/frontend/assets/*.css); grep -rhoE "(bg|text|border|ring|divide|placeholder)-(surface|ink|outline)-[a-z0-9-]+" frontend/src | sort -u | while read c; do echo "$css" | grep -q "$c" || echo "MISSING $c"; done
  ```

- One copy of ProseMirror only. `package.json` `resolutions` pins
  `prosemirror-model` / `prosemirror-view`; after adding any TipTap package run
  `find node_modules -path "*/node_modules/*/node_modules/prosemirror-*"` — it must be empty.
- Icons: `<LucideFileText />` in templates is auto-imported; in `<script>` import
  `~icons/lucide/<name>`; in frappe-ui props use the string `'lucide-<name>'`.
- Absolute asset paths in templates (`src="/assets/..."`) break the Vite build; bind them.
- Inputs inside node views: TipTap re-focuses the editor a frame after a slash command
  inserts a block. Focus the input after two `requestAnimationFrame`s and ignore blur
  right after mount (see `TaskBlockView.vue`), or the draft deletes itself.
- The bubble menu must not show for a `NodeSelection` (whole block selected).
- TipTap's `commands.focus()` is deferred a frame; call `view.focus()` first when
  focus must move immediately (see `Editor.vue`).
- The `@tiptap/extension-drag-handle` peer-requires Yjs packages; they are installed
  on purpose (needed for collaboration later).

## Writing browser tests

- Give every record a test creates a unique name (`Date.now()`), clean it up at the
  end, and never select by text that a leftover from an earlier run could also match.
- Be precise with selectors: the sidebar is an `<aside>` with draggable page rows, and
  frappe-ui's toaster is a `<section aria-label>`; use `aside[aria-label="Task details"]`,
  `section[data-column] [draggable]`.
- frappe-ui `FormControl type="date"` is a custom picker, not `<input type=date>`; Folio
  uses native date inputs (`.folio-select`) for dates.
- A second user in the same test needs its own `browser.createBrowserContext()`;
  a new page shares cookies, so `/login` redirects into the Desk as the first user.
- Wait for confirmation dialogs to finish closing before clicking what's under them.
- A menu's trigger must stay rendered while the menu is open (`v-model:open` on
  frappe-ui `Dropdown`). Hover-only (`hidden group-hover:flex`) triggers vanish when the
  pointer moves to the menu, and the menu jumps to the top-left corner.
- TipTap fires `onUpdate` for read-only editors too (structural transactions); the
  Editor only emits updates while editable and Page.vue never saves without `can_edit`.
- Sidebar rows and the page header both have `button[aria-label="Page actions"]`;
  scope selectors (`main header …`).
- Starter page text lives in `folio/starter.py`; changing it only affects sites that
  don't have those pages yet (or after Folio Settings → Add Getting Started pages).
- After a refused change, re-render bound `<select>`s (`:key` on a version counter):
  Vue doesn't repaint a select whose bound value didn't change.
- HTML5 drag and drop: dispatch `DragEvent`s with a shared `DataTransfer`
  (see `e2e/board.mjs`); headless Chrome doesn't synthesise them from mouse moves.
- The Vite build does not catch undefined variables in `<script setup>` (a missing
  `useRoute()` import only failed at runtime). Exercise new code paths in a browser test.

## Before you say "done"

1. `run-tests` is OK on `folio-test.localhost` and `folio-erp-test.localhost`.
2. `yarn build` succeeds with no new warnings you introduced.
3. For UI work: `yarn e2e` passes and you looked at the screenshots.
4. `docs/features.md` describes every user-visible change you made (in user terms); if the
   change is visible in a README screenshot, refresh the screenshots.
5. `yarn lint` passes (catches undefined variables the build misses).
6. `docs/roadmap.md` is updated if a roadmap item moved; `docs/decisions.md` if you
   made a design decision someone would otherwise undo.
