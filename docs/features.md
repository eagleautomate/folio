# Folio — features

What Folio can do today, for the people using it. Keep this list current: every
user-visible change updates it (see AGENTS.md). Planned work lives in
[roadmap.md](roadmap.md).

Open Folio at `/folio` on your site. Any desk user can use it; website users and
guests can't.

## Getting started

- A **Getting Started** space comes with Folio: *Welcome to Folio*, *Writing pages*,
  *Organising your work*, *Projects & tasks* (with ERPNext), *Who sees what*, and
  *Templates* (Meeting notes, Project brief, Weekly plan).
- Everyone can read it; Folio Managers can edit it or delete it. It is added once per
  site; Folio Settings → **Add Getting Started pages** brings it (or missing pages) back.
- **Copy to…** (a page's ••• menu, top right or in the sidebar) copies any page you can
  read, with its sub-pages, into a space you can edit. That's how templates are used.

## Workspace and navigation

- **Spaces** group pages, like Notion teamspaces. A space is either visible to
  everyone in the company or private to its members.
- **Members and access** per space: *Full Access* (manage the space and its members),
  *Can Edit*, *Can View*. Company-wide spaces also have a default access for
  non-members. Folio Managers and System Managers can open every space.
- **Sidebar** with favorites, every space, and nested pages. Spaces and pages
  can be collapsed and remember that.
- **Drag and drop pages** in the sidebar: before, after or inside another page, or
  onto a space.
- **Search (⌘K)** across titles and page text, including task titles in pages.
  Shows recently edited pages when empty, with keyboard navigation.
- **Home**: greeting, recently edited pages as cards, quick "New page" per space.
- **Trash**: pages (with their sub-pages) go to the trash first; restore them, or
  delete them forever from there.
- **Favorites**: star a page from its header or the sidebar menu.
- **New space** dialog with icon and visibility.
- **Space settings** (the ⋯ menu on a space in the sidebar):
  - *General*: icon, name, description, who can see it (everyone / only members),
    what non-members can do (edit / view), and the ERPNext project that `/task` in
    this space defaults to. Save or cancel; unsaved changes are flagged.
  - *Members*: add people by name or email with an access level, change anyone's
    access, remove people (or leave the space yourself).
  - A space always keeps at least one Full Access member; Folio refuses to remove or
    downgrade the last one and says why.
  - *Delete space*: permanently deletes the space and all its pages, after a
    confirmation that says how many. The Projects space can't be deleted.
  - People without Full Access see the settings read-only.
- The same access rules apply in the Frappe desk (`/desk/folio-page`), so private
  pages can't be found there either.

## Pages

- **Title, emoji icon and cover** (gradient covers, change or remove).
- **Autosave** as you type, with a "Saving… / Edited 5 minutes ago" indicator.
  Relative times are correct in any browser time zone.
- **Edit conflicts**: if someone else saved the page while you were editing, Folio
  loads their version and tells you, instead of overwriting their work.
- **Version history**: snapshots as you edit (at most one per person every 10
  minutes), preview any version, restore it. Restoring keeps the current state as a
  version too, so it can be undone.
- **Page menu**: full width, lock page (read-only for everyone until unlocked),
  version history, copy link, open in Desk, move to trash.
- **Duplicate** a page with all its sub-pages, or **Copy to…** another space.
- **Read-only** view for people with *Can View* access, and for locked or trashed pages.

## Editor

- **Blocks**: text, headings 1–3, bulleted / numbered / to-do lists, quote, callout
  (with a changeable emoji), divider, code block with syntax highlighting, table
  (resizable columns), image.
- **Slash menu (`/`)** to insert any block; the best name match comes first.
- **Markdown shortcuts**: `#` headings, `-` / `1.` lists, `[]` to-dos, `>` quote,
  ```` ``` ```` code, `---` divider, `**bold**`, `*italic*`, `` `code` ``.
- **Formatting toolbar** on selected text: turn into another block type, bold,
  italic, underline, strikethrough, inline code, highlight, link.
- **Drag handle** to move any block up or down the page.
- **@mentions** of teammates.
- **Sub-pages**: `/page` creates a page inside this one and links to it; the link
  shows the sub-page's live title and icon.
- **Images**: upload from the `/` menu, paste or drop them in. Stored as private
  files on the page.

## ERPNext projects and tasks (when ERPNext is installed)

Everything here reads and writes the real ERPNext records, using ERPNext's own
permissions and rules. Folio never keeps a copy of task or project data.

**Who sees a project's page** is decided by Frappe's own permissions on that Project
(roles and User Permissions), on top of the space rules:

- can't read the Project in ERPNext → its page and sub-pages are hidden everywhere
  in Folio (sidebar, search, Home, trash, the Desk list) and links to them say
  "This page isn't available";
- can read but not edit the Project → its pages are read-only;
- people without access to projects at all don't see "All projects", and get a clear
  message if they open it;
- people who can read projects but not tasks see the project without its task list.

Being on a project's team or assigned its tasks doesn't matter for this: ERPNext
itself lets every Projects User see every project unless a User Permission limits it.

### A page for every project

- **Every ERPNext Project gets a Folio page automatically**, in the **Projects**
  space, including projects that existed before Folio was installed. Renaming the project renames the page (unless you gave the page your own
  title). Deleting the project moves its page to the trash.
- **Folio Settings** (`/desk/folio-settings`): turn automatic project pages on or
  off, choose the space they live in, and create pages for existing projects with
  one button.
- **Project page header**, live from ERPNext: status (change it right there),
  % complete, dates, priority, customer, team, link to the project in the Desk.
  ERPNext marks a project *Completed* by itself once all its tasks are done, so
  "Completed" is only offered then (or when the project's % complete is set to
  Manual); *On hold* and *Cancelled* can be set any time.
- **Overview** tab: free-form notes, goals and decisions for the project.
- **Tasks** tab: the project's one task list.
  - **List** view: filter, "My tasks", add a task (Enter), tick to complete,
    completed tasks folded away.
  - **Board** (Kanban) view: columns by **status** (Open, Working, Pending Review,
    Completed), **assignee** or **priority**. Drag a card to change that field in
    ERPNext. Overdue tasks show a red flag.
  - **Table** view: sortable by task, status, assignee, priority, due date, ID.
  - **Task panel**: click any task to edit its title, status, assignees, priority,
    start and due dates, and description. Dates can't go past the project's end
    date; if ERPNext refuses a change, you see ERPNext's message.
  - The view, grouping and open task are in the URL, so links open exactly that view.

### Projects overview

- **Projects** in the sidebar's top section opens the overview, for everyone who can
  see projects in ERPNext.
- **Sidebar** shows only active projects under Projects; completed and cancelled ones
  move to a "N completed" link (the page you have open always stays visible).
- **All projects** (top of the Projects space in the sidebar, or `/folio/projects`):
  every project you can see in ERPNext, with status, progress, dates, open and
  overdue tasks, and team.
- **Table** (sortable) or **Board** by project status. Drag a project card to change
  its status.
- **Filters**: active / completed & cancelled / all, search, "My projects" (you're a
  project member, have a task in it, or created it).
- **New project**: creates the ERPNext Project (name, dates, priority) and opens its
  new page on the Tasks tab.

### Tasks in any page

- **`/task`**: create a new ERPNext Task or link an existing one. On a project page
  it always belongs to that project.
- Task blocks show live status, project, due date and assignees; tick to complete;
  the title opens the task in the Desk. Changes made in the Desk appear when you
  come back to the tab.
- **`/project`** (on ordinary pages): a live card of a project's status, progress and
  task counts, linking to its page.
- If you can't see a task or project in ERPNext, its block says so instead of
  showing its details.
