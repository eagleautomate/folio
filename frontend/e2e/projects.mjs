// Browser test for project pages (needs ERPNext + demo data).
//   node e2e/projects.mjs e2e/shots
// As anna.keller@folio.test: project page header + Overview/Tasks tabs, scoped
// /task, no /project on project pages, Tasks tab add/tick, status change, a new
// Project's auto page, the project card on a normal page, delete -> trash.
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
const text = (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim())
const slashTitles = () => page.$$eval('button span.text-base', (els) => els.map((e) => e.textContent.trim()))
const tab = async (label) => {
  const [btn] = await page.$$(`xpath/.//nav[@role="tablist"]//button[contains(., "${label}")]`)
  await btn.click()
  await sleep(300)
}
const created = { pages: [], tasks: [], projects: [] }

await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
let sidebar = await api('folio.api.workspace.get_sidebar')
const projectsSpace = sidebar.spaces.find((s) => s.title === 'Projects')
const relaunch = sidebar.pages.find((p) => p.title === 'Website Relaunch' && p.space === projectsSpace.name)
step(`Website Relaunch page lives in "${projectsSpace.title}"`)

// 1. header + tabs
await page.goto(`${B}/folio/p/${relaunch.name}`, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => document.querySelector('a[href^="/desk/project/"]'))
step('header: ' + (await page.$eval('a[href^="/desk/project/"]', (a) => a.parentElement.innerText.replace(/\s+/g, ' ').trim())))
step('tabs: ' + (await text('nav[role=tablist]')))
await page.screenshot({ path: `${out}/project-overview.png` })

// 2. Overview: no /project, /task is scoped to this project
await page.click('.folio-prose')
await page.keyboard.down('Meta'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Meta')
await page.keyboard.press('Enter')
await page.keyboard.type('/proj')
await sleep(400)
const projItems = await slashTitles()
step(`"/proj" on a project page offers: [${projItems.join(', ')}] (no "Project")`)
if (projItems.includes('Project')) throw new Error('/project should be hidden on project pages')
for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace')
await page.keyboard.type('/task')
await page.waitForSelector('xpath/.//button[.//span[text()="Task"]]')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.activeElement?.matches('.folio-task input'))
await sleep(500)
const suggestions = await page.$$eval('.folio-task button', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')))
const projectTasks = (await api('folio.api.projects.get_project', { name: 'PROJ-0001' })).tasks.map((t) => t.name)
const foreign = suggestions.filter((sug) => !projectTasks.some((n) => sug.includes(n)))
step(`/task suggests ${suggestions.length} tasks, all from this project: ${foreign.length === 0}`)
await page.keyboard.press('Escape')
await sleep(1200) // autosave of the removed draft

// 3. Tasks tab: add + tick
await tab('Tasks')
await page.waitForSelector('input[placeholder^="Add a task to this project"]')
await page.click('input[placeholder^="Add a task to this project"]')
await page.keyboard.type('E2E tasks-tab item')
await page.keyboard.press('Enter')
await page.waitForFunction(() => [...document.querySelectorAll('a[href^="/desk/task/"]')].some((a) => a.textContent.trim() === 'E2E tasks-tab item'))
const newTask = (await api('frappe.client.get_list', { doctype: 'Task', filters: { subject: 'E2E tasks-tab item' }, fields: ['name', 'project'] }))[0]
created.tasks.push(newTask.name)
step(`Tasks tab created ${newTask.name} in ${newTask.project}; URL ?tab=tasks: ${page.url().includes('tab=tasks')}`)
const [row] = await page.$$('xpath/.//a[normalize-space()="E2E tasks-tab item"]/parent::div')
await (await row.$('button[aria-label="Mark as completed"]')).click()
await page.waitForFunction(() => !/E2E tasks-tab item/.test([...document.querySelectorAll('.divide-y')][0]?.innerText || ''))
step('ticked task moved out of the open list')
await page.screenshot({ path: `${out}/project-tasks.png` })

// 4. status change from the header (then back)
await page.click('button[aria-label="Change project status"]')
await page.waitForSelector('xpath/.//*[@role="menuitem" and contains(., "On hold")]')
await (await page.$('xpath/.//*[@role="menuitem" and contains(., "On hold")]')).click()
await page.waitForFunction(() => document.querySelector('button[aria-label="Change project status"]').innerText.includes('On hold'))
step('status -> ' + (await api('frappe.client.get_value', { doctype: 'Project', filters: 'PROJ-0001', fieldname: 'status' })).status)
await api('folio.api.projects.set_status', { name: 'PROJ-0001', status: 'Open' })

// 5. a new Project gets its page in Projects
const company = (await api('frappe.client.get_list', { doctype: 'Company', fields: ['name'], limit_page_length: 1 }))[0].name
const project = await api('frappe.client.insert', { doc: { doctype: 'Project', project_name: `E2E Office move ${Date.now().toString().slice(-5)}`, company } })
created.projects.push(project.name)
sidebar = await api('folio.api.workspace.get_sidebar')
const newPage = sidebar.pages.find((p) => p.title === project.project_name)
step(`new ${project.name} -> page in "${sidebar.spaces.find((s) => s.name === newPage.space).title}"`)

// 6. project card on an ordinary page
const wiki = sidebar.spaces.find((s) => s.title === 'Company Wiki').name
const note = await api('folio.api.pages.create_page', { space: wiki, title: 'E2E meeting notes' })
created.pages.push(note.name)
await page.goto(`${B}/folio/p/${note.name}`, { waitUntil: 'networkidle0' })
await page.click('.folio-prose')
await page.keyboard.type('/project')
await page.waitForSelector('xpath/.//button[.//span[text()="Project"]]')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.activeElement?.matches('.folio-project input'))
await page.keyboard.type('Website')
await sleep(500)
await page.keyboard.press('Enter')
await page.waitForSelector('.folio-project a[href^="/folio/p/"]')
step('card on a normal page: ' + (await text('.folio-project')))
await page.screenshot({ path: `${out}/project-card.png` })
await page.click('.folio-project a[href^="/folio/p/"]')
await page.waitForFunction((n) => location.pathname.endsWith(n) && location.search.includes('tab=tasks'), {}, relaunch.name)
step('"Open project page" lands on the Tasks tab')

// cleanup
for (const t of created.tasks) await api('frappe.client.delete', { doctype: 'Task', name: t })
for (const p of created.projects) await api('frappe.client.delete', { doctype: 'Project', name: p })
const trash = await api('folio.api.pages.get_trash')
step(`deleted project's page went to trash: ${trash.some((p) => p.name === newPage.name)}`)
for (const name of [newPage.name, ...created.pages]) {
  await api('folio.api.pages.archive_page', { name }).catch(() => {})
  await api('folio.api.pages.delete_page', { name })
}
step('cleaned up')
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
