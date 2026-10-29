# Folio

A Notion-style workspace — pages, docs and (soon) databases — built natively on the
Frappe Framework, so it lives inside your ERPNext site next to projects, tasks,
timesheets and people.

**Status:** core pages done; ERPNext projects and tasks in progress. Full list of
what it does: [docs/features.md](docs/features.md). Plans: [docs/roadmap.md](docs/roadmap.md).

## Highlights

- Spaces, nested pages, ⌘K search, trash, favorites, version history
- Block editor with `/` menu, Markdown shortcuts, drag handle, tables, code, images
- A Folio page for every ERPNext project, with a live header, Overview and a Tasks
  tab (List / Kanban board / Table, task side panel)
- Projects overview of every project; New project from Folio
- `/task` and `/project` blocks backed by the real ERPNext records and permissions

## Install

```bash
bench get-app https://github.com/eagleautomate/folio
bench --site <site> install-app folio
bench build --app folio
```

Open `https://<site>/folio`. Requires Frappe v16. ERPNext is optional today and
required for the upcoming project/task features.

Try it with demo data:

```bash
bench --site <site> execute folio.demo.seed.run
```

## Development

See [AGENTS.md](AGENTS.md) for layout, commands and conventions, and
[docs/architecture.md](docs/architecture.md) for how it fits together.

## License

MIT
