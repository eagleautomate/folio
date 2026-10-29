# Folio roadmap

Status keys: `[x]` done and verified · `[ ]` not started · `[~]` partly done.
Each step ships on its own and is verified (tests + build + browser check) before the next.

## Phase 1 — Core pages (current)

- [x] App scaffold, sites `folio.localhost` (demo) and `folio-test.localhost` (tests)
- [x] DocTypes: Space, Space Member, Page, Page Version, Favorite
- [x] Space-based access control shared by API and desk (+ tests)
- [x] Page API: create, save with conflict check, move, duplicate, archive/restore/delete, favorites, versions
- [x] SPA shell: sidebar with spaces, nested page tree, favorites, home, trash, ⌘K search
- [x] Sidebar drag & drop (before / inside / after, and onto a space)
- [x] Editor: headings, lists, to-dos, quote, callout, divider, code (highlighted), table, image upload/paste, links, highlight
- [x] Slash menu, bubble formatting menu, block drag handle, @mention users, sub-page blocks
- [x] Page icon (emoji), cover (gradients), full width, lock, version history + restore
- [x] Demo data seeder + browser smoke test
- [ ] Space settings dialog (rename, icon, visibility, members) — API exists, no UI yet
- [ ] Per-page share with specific users (beyond space membership)
- [ ] Comments on pages (Frappe `Comment`) and notifications for @mentions
- [ ] Mobile layout (collapsible sidebar)
- [ ] Dark mode toggle (tokens already theme-aware)

## Phase 2 — Databases

- [ ] `Folio Database` + `Folio View` (table, board) with properties stored as JSON rows
- [ ] Filters, sorts, grouping; inline database block inside a page
- [ ] Each row opens as a page

## Phase 3 — ERPNext layer

- [ ] Linked database views over Task / Project / Timesheet / Issue (permission-checked)
- [ ] `/task` block = real ERPNext Task (tick = Completed, live status)
- [ ] Record mentions (`@PROJ-0001`) with live status chips
- [ ] Auto page per Project (hook on Project insert), linked to the project space
- [ ] Timesheet timer on task blocks + weekly timesheet grid

## Phase 4 — Collaboration

- [ ] Yjs co-editing over Frappe socket.io (`folio/realtime/handlers.js`), live cursors
- [ ] Presence (who is on this page)
- [ ] Page templates (meeting notes, project brief, sprint)

## Phase 5 — Extras

- [ ] Calendar / gallery / timeline views
- [ ] Public (published) pages
- [ ] Import from Notion / Markdown, export to Markdown/PDF
- [ ] AI writing help
