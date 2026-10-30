# Privacy Policy

Folio is a self-hosted Frappe app published by **Eagle Automate**. This policy
describes what the Folio app itself does with data.

## Where your data is stored

Everything Folio creates (spaces, pages, page versions, favourites, settings) is
stored in **your own Frappe site's database**. Images added to pages are stored with
Frappe's standard file upload, on your site. Projects and tasks are your existing
ERPNext records; Folio doesn't keep copies of them.

Eagle Automate has no access to your site or your data.

## What Folio sends elsewhere

**Nothing.** Folio sends no data to Eagle Automate or any third party. It contains no
telemetry, analytics, tracking or "phone home" calls. This was checked in the code:

- The server side (`folio/`) makes no outgoing network requests, sends no email and
  runs no background jobs.
- The browser side (`frontend/`) only talks to your own site's API (`/api/...`).
  Fonts and icons are bundled with the app, page covers are CSS colour gradients, and
  real-time sockets are switched off.

One thing to know: if someone puts a link or an image address from another website
into a page, people who view that page load the image from that website, as with
any web page. Folio itself doesn't add such content.

## Your site and hosting

Folio runs inside your Frappe site, so your hosting provider (for example Frappe
Cloud) and your Frappe and ERPNext set-up have their own privacy terms. Those apply
to your site as a whole.

## Contact

Questions about this policy: mn@eagleautomation.in
