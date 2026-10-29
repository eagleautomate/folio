// Browser test for the Tasks tab Board / Table views and the task side panel.
//   node e2e/board.mjs e2e/shots
// As anna.keller@folio.test on the Website Relaunch project page. Works on one
// throwaway task, which it deletes at the end. Drag and drop is driven with real
// DragEvents (headless Chrome doesn't synthesise HTML5 drags from mouse moves).
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1440, height: 900 } })
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
const SUBJECT = `E2E board card ${Date.now().toString().slice(-6)}`
const task = () => api('frappe.client.get_value', { doctype: 'Task', filters: { subject: ['like', `${SUBJECT}%`] }, fieldname: ['name', 'status', 'priority', 'subject', 'exp_end_date', '_assign'] })
const columns = () => page.$$eval('section[data-column]', (els) => els.map((e) => `${e.getAttribute('aria-label')}:${e.querySelectorAll('[draggable]').length}`))
async function drag(columnLabel) {
  await page.evaluate((subject, label) => {
    const card = [...document.querySelectorAll('section[data-column] [draggable="true"]')].find((c) => c.innerText.includes(subject))
    const col = document.querySelector(`section[data-column][aria-label="${label}"]`)
    const dt = new DataTransfer()
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
  }, SUBJECT, columnLabel)
  await page.waitForFunction(
    (subject, label) => document.querySelector(`section[data-column][aria-label="${label}"]`)?.innerText.includes(subject),
    { timeout: 8000 }, SUBJECT, columnLabel,
  )
}

await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
const sidebar = await api('folio.api.workspace.get_sidebar')
const projectsSpace = sidebar.spaces.find((s) => s.title === 'Projects').name
const relaunch = sidebar.pages.find((p) => p.title === 'Website Relaunch' && p.space === projectsSpace)
await api('folio.api.tasks.create_task', { page: relaunch.name, subject: SUBJECT })
const { name } = await task()

// board, grouped by status
await page.goto(`${B}/folio/p/${relaunch.name}?tab=tasks&view=board`, { waitUntil: 'networkidle0' })
await page.waitForSelector('section[aria-label="Open"]')
step('board columns: ' + (await columns()).join(' | '))
await drag('Working')
step(`drag to Working -> ERPNext status ${(await task()).status}`)
await page.screenshot({ path: `${out}/board-status.png` })

// grouped by priority
await page.select('select[aria-label="Group by"]', 'priority')
await page.waitForSelector('section[aria-label="Urgent"]')
await drag('Urgent')
step(`group by priority, drag to Urgent -> ${(await task()).priority}; URL has group=priority: ${page.url().includes('group=priority')}`)

// grouped by assignee
await page.select('select[aria-label="Group by"]', 'assignee')
await page.waitForSelector('section[aria-label="Unassigned"]')
step('assignee columns: ' + (await columns()).join(' | '))
await drag('Luca Meier')
step(`drag to Luca Meier -> assigned ${(await task())._assign}`)
await drag('Unassigned')
step(`drag to Unassigned -> assigned ${(await task())._assign}`)
await page.screenshot({ path: `${out}/board-assignee.png` })

// table
await page.click('[role="radio"][aria-checked="false"]:last-child')
await page.waitForSelector('table tbody tr')
const before = await page.$$eval('tbody tr td:nth-child(2)', (tds) => tds.map((t) => t.innerText.trim()))
const [subjectHeader] = await page.$$('xpath/.//thead//button[contains(., "Task")]')
await subjectHeader.click()
const after = await page.$$eval('tbody tr td:nth-child(2)', (tds) => tds.map((t) => t.innerText.trim()))
const sortedOk = JSON.stringify(after) === JSON.stringify([...after].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))
step(`table: ${before.length} rows, sort by Task works: ${sortedOk}`)
await page.screenshot({ path: `${out}/table.png` })

// side panel
const [row] = await page.$$(`xpath/.//tbody//tr[.//td[normalize-space()="${SUBJECT}"]]`)
await row.click()
await page.waitForSelector('aside[aria-label="Task details"] textarea')
step(`panel opened, URL has task=${name}: ${page.url().includes('task=' + name)}`)
await page.select('aside select:not([aria-label])', 'Pending Review')
await page.waitForFunction(async () => true)
await sleep(700)
const title = await page.$('aside textarea')
await title.click({ clickCount: 3 })
await page.keyboard.type(SUBJECT + ' (edited)')
await page.keyboard.press('Enter')
await sleep(700)
await page.select('aside select[aria-label="Add assignee"]', 'sophie.brunner@folio.test')
await page.waitForFunction(() => document.querySelector('aside[aria-label="Task details"]').innerText.includes('Sophie Brunner'), { timeout: 5000 }).catch(async () => { await page.screenshot({ path: `${out}/panel-fail.png` }); console.log('assign failed; errors:', errors, 'options:', await page.$$eval('aside select[aria-label="Add assignee"] option', (o) => o.map((x) => x.value).slice(0, 8))); process.exit(1) })
const setDue = (value) =>
  page.evaluate((value) => {
    const due = document.querySelectorAll('aside[aria-label="Task details"] input[type=date]')[1]
    due.value = value
    due.dispatchEvent(new Event('input', { bubbles: true }))
    due.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
const max = await page.$eval('aside[aria-label="Task details"] input[type=date]:last-of-type', (i) => i.max)
// a date after the project's end: ERPNext refuses, the panel shows why and resets
await setDue('2027-06-30')
await page.waitForFunction(() => /cannot be after/i.test(document.body.innerText), { timeout: 8000 })
await sleep(500)
const resetTo = await page.$eval('aside[aria-label="Task details"] input[type=date]:last-of-type', (i) => i.value)
step(`date after project end (${max}) refused with ERPNext's message; field reset to "${resetTo}"`)
errors.splice(0) // that 417 was expected
await setDue('2026-12-01')
await sleep(900)
await page.screenshot({ path: `${out}/task-panel.png` })
const saved = await api('frappe.client.get_value', { doctype: 'Task', filters: name, fieldname: ['subject', 'status', 'exp_end_date', '_assign'] })
step('panel edits saved in ERPNext: ' + JSON.stringify(saved))
await page.keyboard.press('Escape')
await page.click('button[aria-label="Close"]').catch(() => {})
await page.waitForFunction(() => !document.querySelector('aside[aria-label="Task details"]'))
step(`panel closed, task param removed: ${!page.url().includes('task=')}`)

await api('frappe.client.delete', { doctype: 'Task', name })
step('cleaned up ' + name)
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
