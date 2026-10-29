# Folio — features

What Folio can do today, for the people using it. Keep this list current: every
user-visible change updates it (see AGENTS.md). Planned work lives in
[roadmap.md](roadmap.md).

Open Folio at `/folio` on your site. Any desk user can use it; website users and
guests can't.

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
- **Duplicate** a page with all its sub-pages.
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

### A page for every project

- **Every ERPNext Project gets a Folio page automatically**, in the **Projects**
  space. Renaming the project renames the page (unless you gave the page your own
  title). Deleting the project moves its page to the trash.
- **Folio Settings** (`/desk/folio-settings`): turn automatic project pages on or
  off, choose the space they live in, and create pages for existing projects with
  one button.
- **Project page header**, live from ERPNext: status (change it right there),
  % complete, dates, priority, customer, team, link to the project in the Desk.
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
