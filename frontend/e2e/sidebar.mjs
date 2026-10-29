// Browser test: finished projects leave the sidebar (needs ERPNext + demo data).
//   node e2e/sidebar.mjs e2e/shots
// "Mobile App MVP" has open tasks, so ERPNext won't let it be Completed: the header
// says so. Cancelling it (which ERPNext keeps) hides it from the sidebar, except while
// you're on it, and adds the "N completed" link. Restores Open at the end.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const step = (s) => console.log('✓', s)
const api = (method, args = {}) =>
  page.evaluate(async (method, args) => {
    const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
    return (await r.json()).message
  }, method, args)
const NAME = 'Mobile App MVP'
const inSidebar = () => page.$$eval('aside span', (els, n) => els.some((e) => e.textContent.trim() === n), NAME)

await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
const sidebar = await api('folio.api.workspace.get_sidebar')
const mvp = sidebar.pages.find((p) => p.title === NAME && p.is_project_page)
try {
  step(`"${NAME}" (${mvp.project_status}) in sidebar: ${await inSidebar()}`)

  // open tasks: "Completed" is offered but disabled, with the reason
  await page.goto(`${B}/folio/p/${mvp.name}`, { waitUntil: 'networkidle0' })
  await page.click('button[aria-label="Change project status"]')
  const completedItem = await page.waitForSelector('xpath/.//*[@role="menuitem" and contains(., "Completed")]')
  const label = await completedItem.evaluate((e) => e.innerText.trim())
  const disabled = await completedItem.evaluate((e) => e.hasAttribute('data-disabled') || e.getAttribute('aria-disabled') === 'true')
  step(`"Completed" with open tasks: "${label}", disabled: ${disabled}`)
  const refused = await page.evaluate(async (project) => {
    const r = await fetch('/api/method/folio.api.projects.set_status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify({ name: project, status: 'Completed' }) })
    return { status: r.status, msg: JSON.parse(JSON.parse((await r.json())._server_messages)[0]).message }
  }, mvp.project)
  step(`API refuses Completed (HTTP ${refused.status}): "${refused.msg.slice(0, 70)}…"`)
  errors.splice(0) // that refusal was expected

  // cancel it from the header: stays visible while you're on it
  await (await page.waitForSelector('xpath/.//*[@role="menuitem" and contains(., "Cancelled")]')).click()
  await page.waitForFunction(() => document.querySelector('button[aria-label="Change project status"]').innerText.includes('Cancelled'))
  await new Promise((r) => setTimeout(r, 800))
  step(`cancelled from header; still in sidebar while open: ${await inSidebar()}`)

  // leave the page: it disappears, the "completed" link appears
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('aside')
  const [more] = await page.$$('xpath/.//aside//button[contains(., "completed")]')
  step(`on Home: in sidebar ${await inSidebar()}, link "${(await more?.evaluate((b) => b.innerText.trim())) || 'missing'}"`)
  await page.screenshot({ path: `${out}/sidebar-completed.png` })
  await more.click()
  await page.waitForFunction(() => location.pathname === '/folio/projects' && location.search.includes('scope=completed'))
  await page.waitForSelector('tbody tr')
  const rows = await page.$$eval('tbody tr td:first-child div:first-child', (els) => els.map((e) => e.textContent.trim()))
  step(`link opens completed projects: [${rows.join(', ')}]`)
} finally {
  await api('folio.api.projects.set_status', { name: mvp.project, status: 'Open' })
}
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
await page.waitForSelector('aside')
step(`restored to Open: back in sidebar ${await inSidebar()}`)
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
