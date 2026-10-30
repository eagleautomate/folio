# Folio — admin guide

For whoever sets Folio up and manages access. Everything here uses standard Frappe and
ERPNext screens; Folio has no separate user or permission system.

## Install

```bash
bench get-app https://github.com/eagleautomate/folio
bench --site <site> install-app folio
bench build --app folio
```

Requires Frappe v16 (on Frappe Cloud: a v16 bench group). ERPNext is optional; the
project and task features switch on when it's installed. People open Folio at
`https://<site>/folio`; it also appears on the `/apps` screen.

Projects that already exist when you install Folio get their pages right away, in a
**Projects** space (unless "Create a page for every new Project" is turned off).

Folio also adds a **Getting Started** space with guides and templates, at the top of the
sidebar. Everyone can read it; Folio Managers can edit it, or delete it once the team
doesn't need it (it won't come back on its own). To restore it, or pages someone
deleted, use **Folio Settings → Add Getting Started pages**.

## Don't see your projects?

Check these, in order:

1. **Update Folio.** Versions before 2026-10-30 only made pages for projects created
   *after* installing Folio. Updating (on Frappe Cloud: deploy the latest version of the
   app; elsewhere `bench update` or `git pull` + `bench --site <site> migrate`) runs a
   one-off migration that creates the missing pages.
2. **Your roles.** Seeing projects needs *Projects User* or *Projects Manager* in
   ERPNext. *System Manager* alone isn't enough: ERPNext doesn't give it project access.
   Without it, the **Projects** link in the sidebar doesn't appear.
3. **User Permissions.** If you have a User Permission on *Project*, you only see those
   projects.
4. **Folio Settings.** If "Create a page for every new Project" is off, use
   **Create pages for existing projects** there.

## Who can use Folio

| Need | Give the user |
|---|---|
| Use Folio (pages, spaces) | Any desk role, or the **Folio User** role if they have no other |
| Open and manage every space | **Folio Manager** (System Manager works too) |
| See ERPNext projects and their pages, and work with tasks | **Projects User** (ERPNext role) |
| Read projects only | a role with *read* on Project (Role Permissions Manager) |

Website users (customers, suppliers) and guests can't use Folio.

## Spaces

Each space has its own access, set in **⋯ → Space settings** in the Folio sidebar:

- *Everyone in the workspace* (with "can edit" or "can only view" for non-members), or
  *Only members*.
- Members get **Full Access** (manage the space and its members), **Can Edit** or
  **Can View**. A space always keeps at least one Full Access member.
- Folio Managers can open every space, including private ones.

## Projects: who sees what

Every ERPNext Project gets a Folio page in the **Projects** space. Who can see or edit
a project's page, and its sub-pages, is decided by **ERPNext's permission on that
Project** for that person, on top of the space rules:

| In ERPNext the person… | In Folio |
|---|---|
| can't read the Project | the page is hidden everywhere (sidebar, search, Home, trash, links) |
| can read but not edit it | the page is read-only |
| can read and edit it | the page is editable (if the space allows) |

This applies to Folio Managers too.

**By default, ERPNext lets every Projects User see every project.** Being on a
project's team or being assigned its tasks doesn't limit that.

### Limit someone to specific projects

Use ERPNext **User Permissions** (Desk → *User Permission* → *New*):

- **User**: the person
- **Allow**: *Project*
- **For Value**: the project they should see

Add one per project. Once a person has at least one Project User Permission, ERPNext,
and therefore Folio, shows them only those projects and their tasks. Remove the rows to
give back access to all projects.

To hide projects from someone completely, don't give them Projects User (or any role
with read on Project).

### Folio Settings

Desk → **Folio Settings** (Folio Managers and System Managers):

- **Create a page for every new Project**: on by default.
- **Space for project pages**: where project pages live (empty: Folio creates a
  "Projects" space the first time it needs one).
- **Create pages for existing projects**: one-off backfill, e.g. after installing
  Folio on a site that already has projects.

### ERPNext rules Folio follows

- A project becomes **Completed** by itself when all its tasks are done (unless its
  *% Complete Method* is *Manual*). Folio only offers "Completed" then. *On hold* and
  *Cancelled* can be set any time.
- A task's dates can't be after its project's expected end date.
- A task can't be completed while a task it depends on is still open.
- **Overdue** is set by ERPNext's daily scheduler, so make sure the scheduler is enabled
  (`bench --site <site> enable-scheduler`).

## Try it with demo data

```bash
bench --site <site> execute folio.demo.seed.run     # spaces, pages, users, projects, tasks
bench --site <site> execute folio.demo.seed.clear   # remove the demo spaces and pages
```

Demo logins use the reserved `.test` domain, e.g. `anna.keller@folio.test`
(Folio Manager), with password `admin12345!`. Don't run the seeder on a live site.
