# Decision log

Short records of choices that someone might otherwise undo. Newest first.

## 2026-10-29 — ERPNext stays optional; ERPNext data obeys ERPNext permissions

Folio installs on plain Frappe; ERPNext features switch on when ERPNext is present
(`required_apps` stays `["frappe"]`). Anything that reads or writes ERPNext records
goes through ERPNext's permission checks as the session user, on top of Folio's page
access. Page access alone never grants access to a Task.

## 2026-10-29 — Task blocks store a reference, not a copy

The page JSON holds the Task name and a cached subject only. Status etc. are always
live, so ERPNext stays the single source of truth and nothing needs syncing back.
Live updates are on window focus for now; push updates come with realtime (phase 4).

## 2026-10-29 — Store a page as one ProseMirror JSON document

Not one row per block (Notion's model). One document per page keeps saves, versions,
permissions and search simple, and maps directly onto TipTap and onto Yjs later.
Block-level features (comments on a block, block links) can use node IDs inside the
JSON when needed.

## 2026-10-29 — Access is per space, pages inherit

Mirrors Notion teamspaces and keeps checks cheap (one lookup per space, cached per
request). Per-page sharing will be an additive exception list, not a replacement.
The rules are implemented once in `folio/permissions.py` and wired to both the API
and Frappe's desk hooks so the two can never disagree.

## 2026-10-29 — Optimistic conflict check instead of real-time editing (for now)

`save_content` compares `base_version` with `content_version`. Another user's newer
save wins and the client reloads; the same user's saves always win. Good enough for
an internal pilot; phase 4 replaces it with Yjs.

## 2026-10-29 — Versions coalesce per author per 10 minutes

A snapshot on every autosave would create hundreds of rows per page. Ten minutes per
author keeps history useful and small.

## 2026-10-29 — Only desk users can use Folio

`is_folio_user` = System User (or Administrator). Website users and guests are
refused even if they guess a URL. A `Folio User` role exists so someone with no other
desk role can still be given access.

## 2026-10-29 — Frontend stack: Vue 3 + frappe-ui + TipTap 3, Vite 5

Same stack as Frappe CRM/Helpdesk in this bench, so look and feel match and the build
setup is proven. TipTap is used directly (not frappe-ui's `TextEditor`) for full control
over blocks, the slash menu and the drag handle.

## 2026-10-29 — Separate test site

Frappe integration tests write to the database. They run on `folio-test.localhost`
(frappe + folio only) so the demo site is never touched, and the site installs in
seconds because it has no ERPNext.
