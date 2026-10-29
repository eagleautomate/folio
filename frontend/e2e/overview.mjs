// Browser test for the projects overview (/folio/projects). Needs ERPNext + demo data.
//   node e2e/overview.mjs e2e/shots
// As anna.keller@folio.test: sidebar link, table + sort, board drag to change the
// project status (restored after), scope and "My projects" filters, New project
// (deleted at the end).
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
const rowNames = () => page.$$eval('tbody tr td:first-child div:first-child', (els) => els.map((e) => e.textContent.trim()))
const cleanup = { projects: [], pages: [] }

await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })

// sidebar -> overview
const [link] = await page.$$('xpath/.//aside//div[normalize-space()="All projects"]')
await link.click()
await page.waitForFunction(() => location.pathname === '/folio/projects')
await page.waitForSelector('tbody tr')
const expected = (await api('folio.api.projects.list_projects', { scope: 'active' })).length
step(`"All projects" opens the overview: ${(await rowNames()).length} rows (API: ${expected} active)`)

const [projHeader] = await page.$$('xpath/.//thead//button[contains(., "Project")]')
await projHeader.click()
const names = await rowNames()
step(`sort by Project: ${JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))}`)
await page.screenshot({ path: `${out}/overview-table.png` })

// board: drag Mobile App MVP to On hold, then put it back
const target = (await api('folio.api.projects.list_projects', { scope: 'active' })).find((p) => p.project_name === 'Mobile App MVP')
await page.click('[role="radio"]:last-child')
await page.waitForSelector('section[data-column="On hold"]')
await page.evaluate((name) => {
  const card = [...document.querySelectorAll('section[data-column] [draggable="true"]')].find((c) => c.innerText.includes(name)) // not the sidebar row
  const col = document.querySelector('section[data-column="On hold"]')
  const dt = new DataTransfer()
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
  col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
  col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
}, 'Mobile App MVP')
await page.waitForFunction(() => document.querySelector('section[data-column="On hold"]').innerText.includes('Mobile App MVP'))
const held = await api('frappe.client.get_value', { doctype: 'Project', filters: target.name, fieldname: 'status' })
step(`board drag -> ${target.name} is "${held.status}" in ERPNext; URL view=board: ${page.url().includes('view=board')}`)
await page.screenshot({ path: `${out}/overview-board.png` })
await api('folio.api.projects.set_status', { name: target.name, status: 'Open' })

// filters
await page.select('select[aria-label="Show"]', 'completed')
await sleep(600)
step(`scope=completed: ${page.url().includes('scope=completed')}, cards: ${await page.$$eval('section[data-column] [draggable]', (c) => c.length)}`)
await page.select('select[aria-label="Show"]', 'active')
const [mineBtn] = await page.$$('xpath/.//button[contains(., "My projects")]')
await mineBtn.click()
await sleep(700)
const mine = await api('folio.api.projects.list_projects', { scope: 'active', mine: 1 })
step(`My projects: URL mine=1 ${page.url().includes('mine=1')}, ${await page.$$eval('section[data-column] [draggable]', (c) => c.length)} cards (API: ${mine.length})`)

// new project
const [newBtn] = await page.$$('xpath/.//button[contains(., "New project")]')
await newBtn.click()
await page.waitForSelector('[role="dialog"] input')
const name = `E2E Overview ${Date.now().toString().slice(-6)}`
await page.type('[role="dialog"] input', name)
await page.evaluate(() => {
  const dates = document.querySelectorAll('[role="dialog"] input[type=date]')
  for (const [i, v] of [[0, '2026-11-02'], [1, '2026-12-18']]) {
    dates[i].value = v
    dates[i].dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await page.screenshot({ path: `${out}/overview-new.png` })
const [createBtn] = await page.$$('xpath/.//button[contains(., "Create project")]')
await createBtn.click()
await page.waitForFunction(() => location.pathname.startsWith('/folio/p/') && location.search.includes('tab=tasks'), { timeout: 15000 })
await page.waitForFunction((n) => document.querySelector('textarea')?.value === n, {}, name)
const created = (await api('folio.api.projects.list_projects', { scope: 'all', query: name }))[0]
cleanup.projects.push(created.name)
cleanup.pages.push(created.page)
step(`New project -> ${created.name} "${created.project_name}" ends ${created.expected_end_date}; opened its page on the Tasks tab`)

// cleanup
for (const p of cleanup.projects) await api('frappe.client.delete', { doctype: 'Project', name: p })
for (const p of cleanup.pages) await api('folio.api.pages.delete_page', { name: p })
step('cleaned up')
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
