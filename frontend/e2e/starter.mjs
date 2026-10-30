// Browser test: Getting Started pages and "Copy to…" (needs the demo data).
//   node e2e/starter.mjs e2e/shots
// Marco (Can Edit on Company Wiki, Can View on Getting Started) copies the Project brief
// template into Company Wiki from the sidebar menu; the copy is deleted afterwards.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const errors = []
const step = (s) => console.log('✓', s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function session(usr) {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => errors.push(`${usr}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${usr}: ${m.text()}`))
  await page.goto(`${B}/login`)
  await page.evaluate((usr) => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr, pwd: 'admin12345!' }) }), usr)
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('aside')
  page.api = (method, args = {}) =>
    page.evaluate(async (method, args) => {
      const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
      return (await r.json()).message
    }, method, args)
  return page
}

const marco = await session('marco.rossi@folio.test')
const sb = await marco.api('folio.api.workspace.get_sidebar')
const gs = sb.spaces.find((s) => s.title === 'Getting Started')
step(`first space in the sidebar: "${sb.spaces[0].title}"; Marco's access to it: ${gs.access}`)
const byTitle = (t) => sb.pages.find((p) => p.space === gs.name && p.title === t)

// read the welcome page: read-only for Marco, links to the guides
await marco.goto(`${B}/folio/p/${byTitle('Welcome to Folio').name}`, { waitUntil: 'networkidle0' })
await marco.waitForSelector('.folio-page-link')
const welcome = await marco.evaluate(() => ({
  editable: document.querySelector('.folio-prose').getAttribute('contenteditable'),
  links: [...document.querySelectorAll('.folio-page-link')].map((l) => l.innerText.trim()),
}))
step(`Welcome: editable=${welcome.editable}, guide links: ${welcome.links.join(' | ')}`)
await marco.screenshot({ path: `${out}/starter-welcome.png` })
await marco.click('.folio-page-link a')
await marco.waitForFunction(() => document.querySelector('textarea')?.value === 'Writing pages')
await sleep(500)
step('clicking the first guide link opens "Writing pages"')
await marco.screenshot({ path: `${out}/starter-writing.png` })

// copy the Project brief *template* into Company Wiki from the page's own ••• menu
const brief = sb.pages.find((p) => p.space === gs.name && p.title === 'Project brief' && p.parent_page === byTitle('Templates').name)
await marco.goto(`${B}/folio/p/${brief.name}`, { waitUntil: 'networkidle0' })
await marco.waitForSelector('.folio-prose')
await marco.click('main header button[aria-label="Page actions"]')
const copyTo = await marco.waitForSelector('xpath/.//*[@role="menuitem" and contains(., "Copy to")]')
await copyTo.hover()
await copyTo.click().catch(() => {})
const target = await marco.waitForSelector('xpath/.//*[@role="menuitem" and contains(., "Company Wiki")]')
await marco.screenshot({ path: `${out}/starter-copy-to.png` })
await target.click()
await marco.waitForFunction((src) => !location.pathname.endsWith(src) && document.querySelector('textarea')?.value === 'Project brief', {}, brief.name)
const copyName = marco.url().split('/p/')[1]
const copy = await marco.api('folio.api.pages.get_page', { name: copyName })
const sameContent = JSON.stringify(copy.content) === JSON.stringify((await marco.api('folio.api.pages.get_page', { name: brief.name })).content)
step(`copied the template "${copy.title}" into ${copy.breadcrumbs[0].title}; same content: ${sameContent}; Marco can edit the copy: ${copy.can_edit}`)

await marco.api('folio.api.pages.archive_page', { name: copyName })
await marco.api('folio.api.pages.delete_page', { name: copyName })
step('cleaned up the copy')
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
