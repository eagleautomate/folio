// Browser test for auto-created project pages (needs ERPNext + demo data).
//   node e2e/projects.mjs e2e/shots
// As anna.keller@folio.test: checks the Website Relaunch project page, creates a
// Project (like the Desk would), opens its auto-created page, adds and ticks a
// task from the project block, then deletes the project and checks the page is trashed.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const step = (s) => console.log('✓', s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const api = (method, args = {}) =>
  page.evaluate(async (method, args) => {
    const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
    const j = await r.json()
    if (!r.ok) throw new Error(method + ': ' + (j._server_messages || j.exception || r.status))
    return j.message
  }, method, args)
const blockText = () => page.$eval('.folio-project', (e) => e.innerText.replace(/\s+/g, ' ').trim())

await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })

// 1. existing project page
let sidebar = await api('folio.api.workspace.get_sidebar')
const relaunch = sidebar.pages.find((p) => p.title === 'Website Relaunch')
await page.goto(`${B}/folio/p/${relaunch.name}`, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => document.querySelector('.folio-project a[href^="/desk/project/"]'))
step('Website Relaunch page: ' + (await blockText()).slice(0, 110) + '…')
await page.screenshot({ path: `${out}/project-relaunch.png` })

// 2. a new Project gets a page automatically
const stamp = Date.now().toString().slice(-5)
const company = (await api('frappe.client.get_list', { doctype: 'Company', fields: ['name'], limit_page_length: 1 }))[0].name
const project = await api('frappe.client.insert', { doc: { doctype: 'Project', project_name: `E2E Office move ${stamp}`, company, expected_end_date: '2026-12-15' } })
sidebar = await api('folio.api.workspace.get_sidebar')
const newPage = sidebar.pages.find((p) => p.title === project.project_name)
const space = sidebar.spaces.find((s) => s.name === newPage?.space)
step(`new Project ${project.name} -> page "${newPage?.title}" in space "${space?.title}"`)

await page.goto(`${B}/folio/p/${newPage.name}`, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => document.querySelector('.folio-project')?.innerText.includes('No tasks yet'))
const sidebarHas = await page.$$eval('aside span', (els, t) => els.some((e) => e.textContent === t), project.project_name)
step(`page open, empty task list, visible in sidebar: ${sidebarHas}`)

// 3. add two tasks from the block, tick one
for (const subject of ['Book movers', 'Order boxes']) {
  await page.click('.folio-project input[placeholder^="Add a task"]')
  await page.keyboard.type(subject)
  await page.keyboard.press('Enter')
  await page.waitForFunction((s) => [...document.querySelectorAll('.folio-project a[href^="/desk/task/"]')].some((a) => a.textContent.trim() === s), {}, subject)
}
const tasks = await api('frappe.client.get_list', { doctype: 'Task', filters: { project: project.name }, fields: ['name', 'subject', 'status'] })
step(`ERPNext has the tasks under ${project.name}: ${tasks.map((t) => t.subject).join(', ')}`)
await page.click('.folio-project button[aria-label="Mark as completed"]')
await page.waitForFunction(() => /1 open\s+1 done/.test(document.querySelector('.folio-project').innerText))
step('ticked one: ' + (await blockText()).match(/\d+ open \d+ done/)[0])
await page.screenshot({ path: `${out}/project-new.png` })

// 4. deleting the project trashes its page
for (const t of tasks) await api('frappe.client.delete', { doctype: 'Task', name: t.name })
await api('frappe.client.delete', { doctype: 'Project', name: project.name })
const trash = await api('folio.api.pages.get_trash')
step(`project deleted -> page in trash: ${trash.some((p) => p.name === newPage.name)}`)
await api('folio.api.pages.delete_page', { name: newPage.name })
step('cleaned up')
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
