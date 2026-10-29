# Folio

A Notion-style workspace — pages, docs and (soon) databases — built natively on the
Frappe Framework, so it lives inside your ERPNext site next to projects, tasks,
timesheets and people.

**Status:** phase 1 (core pages) — see [docs/roadmap.md](docs/roadmap.md).

## Features today

- Spaces (team-wide or private) with members and access levels
- Nested pages with drag & drop, favorites, trash, ⌘K full-text search
- Block editor: headings, lists, to-dos, quotes, callouts, code, tables, images,
  links, @mentions, sub-page blocks, slash menu, drag handle
- Icons, covers, full-width and locked pages, version history with restore
- The same access rules in the Folio app and in the Frappe desk

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
