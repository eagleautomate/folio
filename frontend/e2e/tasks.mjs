// Browser test for ERPNext task blocks (needs ERPNext + demo data on the site).
//   node e2e/tasks.mjs e2e/shots
// As sophie.brunner@folio.test: renders task blocks for existing tasks, creates a page,
// adds a task with /task, ticks it, checks ERPNext, reloads, then cleans up.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 860 } })
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'sophie.brunner@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
const sidebar = await api('folio.api.workspace.get_sidebar')

// 1. task blocks referencing existing tasks render live data
const space = sidebar.spaces.find((s) => s.title === 'Website Relaunch').name
const existing = await api('frappe.client.get_list', { doctype: 'Task', filters: { project: 'PROJ-0001' }, fields: ['name', 'subject'], limit_page_length: 2 })
const board = await api('folio.api.pages.create_page', {
  space,
  title: 'E2E task references',
  content: { type: 'doc', content: existing.map((t) => ({ type: 'erpnextTask', attrs: { task: t.name, subject: t.subject } })) },
})
await page.goto(`${B}/folio/p/${board.name}`, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => document.querySelectorAll('.folio-task a[href^="/desk/task/"]').length > 0)
await sleep(400)
const rows = await page.$$eval('.folio-task', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
step(`${rows.length} live task blocks, e.g. "${rows[0]}"`)
await page.screenshot({ path: `${out}/tasks-board.png` })

// 2. create a page, add a task with /task
const created = await api('folio.api.pages.create_page', { space, title: 'Task block test' })
await page.goto(`${B}/folio/p/${created.name}`, { waitUntil: 'networkidle0' })
await page.waitForSelector('.folio-prose')
await page.click('.folio-prose')
await page.keyboard.type('/task')
await page.waitForSelector('xpath/.//button[.//span[text()="Task"]]')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.activeElement?.matches('.folio-task input'))
await page.keyboard.type('E2E task from Folio')
await sleep(400)
await page.screenshot({ path: `${out}/tasks-draft.png` })
await page.keyboard.press('Enter')
await page.waitForSelector('.folio-task a[href^="/desk/task/"]')
const taskName = (await page.$eval('.folio-task a', (a) => a.getAttribute('href'))).split('/').pop()
let erp = await api('frappe.client.get_value', { doctype: 'Task', filters: taskName, fieldname: ['subject', 'status', 'project'] })
step(`created ${taskName} in ERPNext: ${JSON.stringify(erp)}`)

// 3. tick it
await page.click('.folio-task button[aria-label="Mark as completed"]')
await page.waitForSelector('.folio-task button[aria-label="Mark as open"]')
erp = await api('frappe.client.get_value', { doctype: 'Task', filters: taskName, fieldname: ['status', 'completed_by'] })
step(`ticked -> ERPNext says ${JSON.stringify(erp)}`)

// 4. change it in "the Desk" (API), come back: the block refreshes on focus
await api('frappe.client.set_value', { doctype: 'Task', name: taskName, fieldname: 'status', value: 'Working' })
await page.evaluate(() => window.dispatchEvent(new Event('focus')))
await page.waitForFunction(() => document.querySelector('.folio-task')?.innerText.includes('Working'))
step('status changed in ERPNext shows up on focus')

// 5. reload: block is saved in the page
await sleep(1200) // autosave
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction((t) => document.querySelector(`.folio-task a[href="/desk/task/${t}"]`), {}, taskName)
step('task block persisted after reload')
await page.screenshot({ path: `${out}/tasks-page.png` })
const hits = await api('folio.api.workspace.search', { query: 'E2E task from Folio' })
step(`search finds the page by task title: ${hits.some((h) => h.name === created.name)}`)

// cleanup
for (const name of [created.name, board.name]) {
  await api('folio.api.pages.archive_page', { name })
  await api('folio.api.pages.delete_page', { name })
}
await page.evaluate(async (t) => {
  await fetch('/api/resource/Task/' + t, { method: 'DELETE', headers: { 'X-Frappe-CSRF-Token': window.csrf_token } })
}, taskName)
step('cleaned up page and task')
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
