// Browser test: table handles. Column / row grips (menu + drag to move), the corner
// menu (headers, delete table), "+" bars, cell colours, read-only viewers, phones.
//   node e2e/tables.mjs e2e/shots
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const errors = []
const step = (s, ok = true) => {
  console.log(ok ? '✓' : '✗', s)
  if (!ok) process.exitCode = 1
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function session(usr, viewport) {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  if (viewport) {
    await page.setViewport(viewport)
    await (await page.createCDPSession()).send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  }
  await page.goto(`${B}/login`)
  await page.evaluate((usr) => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr, pwd: 'admin12345!' }) }), usr)
  await page.evaluate(() => localStorage.setItem('folio:install-dismissed', String(Date.now())))
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  page.api = (method, args = {}) =>
    page.evaluate(async (method, args) => {
      const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
      return (await r.json()).message
    }, method, args)
  return page
}

const cellNode = (type, text) => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const tableDoc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Budget' }] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: ['Item', 'Qty', 'Price'].map((t) => cellNode('tableHeader', t)) },
        { type: 'tableRow', content: ['Laptops', '4', '1200'].map((t) => cellNode('tableCell', t)) },
        { type: 'tableRow', content: ['Monitors', '6', '300'].map((t) => cellNode('tableCell', t)) },
      ],
    },
    { type: 'paragraph' },
  ],
}

// the table as text, row by row
const grid = (page) => page.$$eval('.ProseMirror table tr', (rows) => rows.map((r) => [...r.children].map((c) => c.textContent.trim())))
const shape = async (page) => {
  const g = await grid(page)
  return `${g.length}x${g[0]?.length || 0}`
}
async function hoverCell(page, row, col) {
  const cell = await page.$(`.ProseMirror table tr:nth-child(${row + 1}) > :nth-child(${col + 1})`)
  const b = await cell.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await wait(150)
}
const handle = (page, label) => page.$(`[data-table-controls] button[aria-label^="${label}"]`)
async function openMenu(page, label) {
  await (await handle(page, label)).click()
  await page.waitForSelector('[role="menu"]')
  await wait(100)
}
async function menuItem(page, text) {
  const items = await page.$$('[role="menu"] [role="menuitem"]')
  for (const i of items) if ((await i.evaluate((e) => e.textContent.trim())) === text) return i
  return null
}
async function choose(page, text) {
  await (await menuItem(page, text)).click()
  await wait(250)
}
async function dragHandle(page, label, dx, dy) {
  const b = await (await handle(page, label)).boundingBox()
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10)
  await wait(100)
  const line = await page.$('[data-table-controls] .bg-blue-500')
  await page.mouse.up()
  await wait(300)
  return !!line
}

const anna = await session('anna.keller@folio.test')
const sb = await anna.api('folio.api.workspace.get_sidebar')
const leadership = sb.spaces.find((s) => s.title === 'Leadership').name // Marco can only view it
const doc = await anna.api('folio.api.pages.create_page', { space: leadership, title: `Table test ${Date.now()}`, content: tableDoc })

try {
  await anna.goto(`${B}/folio/p/${doc.name}`, { waitUntil: 'networkidle0' })
  await anna.waitForSelector('.ProseMirror table')
  step(`starts as ${await shape(anna)}`, (await shape(anna)) === '3x3')

  // hovering a cell shows its column and row grips, the corner button and the + bars
  await hoverCell(anna, 1, 1)
  const shown = { col: !!(await handle(anna, 'Column 2')), row: !!(await handle(anna, 'Row 2')), corner: !!(await handle(anna, 'Table options')), addRow: !!(await handle(anna, 'Add a row')), addCol: !!(await handle(anna, 'Add a column')) }
  step(`hover: grips for column 2 and row 2, corner and + bars ${JSON.stringify(shown)}`, Object.values(shown).every(Boolean))
  const colBox = await (await handle(anna, 'Column 2')).boundingBox()
  const cellBox = await (await anna.$('.ProseMirror table tr:nth-child(1) > :nth-child(2)')).boundingBox()
  step(`column grip sits on the column's top edge (grip y=${Math.round(colBox.y + colBox.height / 2)}, edge y=${Math.round(cellBox.y)})`, Math.abs(colBox.y + colBox.height / 2 - cellBox.y) < 3 && Math.abs(colBox.x + colBox.width / 2 - (cellBox.x + cellBox.width / 2)) < 3)
  const blockGrip = await anna.$eval('.folio-drag-handle', (h) => getComputedStyle(h).visibility).catch(() => 'hidden')
  step(`the block drag handle steps aside for the corner button (${blockGrip})`, blockGrip === 'hidden')
  await anna.screenshot({ path: `${out}/tables-hover.png` })

  // column menu
  await openMenu(anna, 'Column 2')
  const labels = await anna.$$eval('[role="menu"] [role="menuitem"]', (b) => b.map((x) => x.textContent.trim()))
  step(`column menu: ${labels.join(', ')}`, ['Color', 'Insert left', 'Insert right', 'Move left', 'Move right', 'Duplicate', 'Clear contents', 'Delete column'].every((l) => labels.includes(l)))
  const outlined = await anna.$('[data-table-controls] .ring-blue-500')
  step(`the column is outlined while its menu is open: ${!!outlined}`, !!outlined)
  await anna.screenshot({ path: `${out}/tables-column-menu.png` })
  await choose(anna, 'Insert right')
  step(`Insert right → ${await shape(anna)}, new column after "Qty": ${JSON.stringify((await grid(anna))[0])}`, (await shape(anna)) === '3x4' && (await grid(anna))[0][2] === '')

  // search the menu and run with Enter
  await hoverCell(anna, 1, 2)
  await openMenu(anna, 'Column 3')
  await anna.keyboard.type('delete')
  const found = await anna.$$eval('[role="menu"] [role="menuitem"]', (b) => b.map((x) => x.textContent.trim()))
  await anna.keyboard.press('Enter')
  await wait(250)
  step(`search "delete" → ${JSON.stringify(found)}, Enter deletes the column → ${await shape(anna)}`, found.length === 1 && found[0] === 'Delete column' && (await shape(anna)) === '3x3')

  // row menu: insert, duplicate, move, colour, clear
  await hoverCell(anna, 1, 0)
  await openMenu(anna, 'Row 2')
  await choose(anna, 'Duplicate')
  step(`Duplicate row → ${JSON.stringify((await grid(anna)).map((r) => r[0]))}`, JSON.stringify((await grid(anna)).map((r) => r[0])) === '["Item","Laptops","Laptops","Monitors"]')
  await hoverCell(anna, 3, 0)
  await openMenu(anna, 'Row 4')
  await choose(anna, 'Move up')
  step(`Move up → ${JSON.stringify((await grid(anna)).map((r) => r[0]))}`, JSON.stringify((await grid(anna)).map((r) => r[0])) === '["Item","Laptops","Monitors","Laptops"]')
  await hoverCell(anna, 3, 0)
  await openMenu(anna, 'Row 4')
  await choose(anna, 'Clear contents')
  step(`Clear contents empties the row: ${JSON.stringify((await grid(anna))[3])}`, (await grid(anna))[3].every((c) => c === ''))
  await hoverCell(anna, 2, 0)
  await openMenu(anna, 'Row 3')
  await choose(anna, 'Color')
  await anna.screenshot({ path: `${out}/tables-colors.png` })
  await choose(anna, 'Blue')
  const colored = await anna.$$eval('.ProseMirror table tr:nth-child(3) > *', (c) => c.map((x) => x.getAttribute('data-background')))
  const bg = await anna.$eval('.ProseMirror table tr:nth-child(3) > *', (c) => getComputedStyle(c).backgroundColor)
  step(`Color → Blue paints the row ${JSON.stringify(colored)} (${bg})`, colored.every((c) => c === 'blue') && bg === 'rgb(231, 243, 248)')

  // drag the first column to the end, and the last row to the top of the body
  await hoverCell(anna, 1, 0)
  const tableBox = await (await anna.$('.ProseMirror table')).boundingBox()
  const colGrip = await (await handle(anna, 'Column 1')).boundingBox()
  const lineShown = await dragHandle(anna, 'Column 1', tableBox.x + tableBox.width - 5 - (colGrip.x + colGrip.width / 2), 0)
  step(`drag column 1 to the end (drop line shown: ${lineShown}) → ${JSON.stringify((await grid(anna))[0])}`, lineShown && JSON.stringify((await grid(anna))[0]) === '["Qty","Price","Item"]')
  await hoverCell(anna, 2, 0)
  const rowGrip = await (await handle(anna, 'Row 3')).boundingBox()
  const firstBody = await (await anna.$('.ProseMirror table tr:nth-child(2)')).boundingBox()
  await dragHandle(anna, 'Row 3', 0, firstBody.y + 4 - (rowGrip.y + rowGrip.height / 2))
  const rows = (await grid(anna)).map((r) => r[2])
  step(`drag row 3 above row 2 → ${JSON.stringify(rows)}`, JSON.stringify(rows) === '["Item","Monitors","Laptops",""]')

  // + bars
  await hoverCell(anna, 1, 1)
  await (await handle(anna, 'Add a row')).click()
  await wait(200)
  await hoverCell(anna, 1, 1)
  await (await handle(anna, 'Add a column')).click()
  await wait(200)
  step(`+ bars add a row and a column → ${await shape(anna)}`, (await shape(anna)) === '5x4')

  // corner: header row off and on, then delete the table (and undo)
  await hoverCell(anna, 0, 0)
  await openMenu(anna, 'Table options')
  const tableLabels = await anna.$$eval('[role="menu"] [role="menuitem"]', (b) => b.map((x) => x.textContent.trim()))
  step(`table menu: ${tableLabels.join(', ')}`, tableLabels.includes('Delete table') && tableLabels.includes('Header row'))
  await anna.screenshot({ path: `${out}/tables-table-menu.png` })
  await choose(anna, 'Header row')
  const headers = await anna.$$eval('.ProseMirror table th', (h) => h.length)
  await hoverCell(anna, 0, 0)
  await openMenu(anna, 'Table options')
  await choose(anna, 'Header row')
  const headersBack = await anna.$$eval('.ProseMirror table tr:first-child th', (h) => h.length)
  step(`Header row toggles off (${headers} header cells) and back on (${headersBack})`, headers === 0 && headersBack === 4)

  // saved: reload keeps the shape and the colour
  await anna.waitForFunction(() => !/Saving|Not saved/.test(document.querySelector('main header')?.textContent || ''), { timeout: 15000 })
  await wait(1000)
  await anna.reload({ waitUntil: 'networkidle0' })
  await anna.waitForSelector('.ProseMirror table')
  const kept = await anna.$$eval('.ProseMirror [data-background="blue"]', (c) => c.length)
  // the coloured row's 3 cells; the column added later comes in uncoloured
  step(`after reload: ${await shape(anna)}, ${kept} blue cells`, (await shape(anna)) === '5x4' && kept === 3)

  // a viewer gets no handles
  const marco = await session('marco.rossi@folio.test')
  await marco.goto(`${B}/folio/p/${doc.name}`, { waitUntil: 'networkidle0' })
  await marco.waitForSelector('.ProseMirror table')
  await hoverCell(marco, 1, 1)
  step(`read-only viewer (Marco): no table handles: ${!(await marco.$('[data-table-controls]'))}`, !(await marco.$('[data-table-controls]')))
  await marco.browserContext().close()

  // phone: the handles follow the cell you tap; the menu fits the screen
  const phone = await session('anna.keller@folio.test', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await phone.goto(`${B}/folio/p/${doc.name}`, { waitUntil: 'networkidle0' })
  await phone.waitForSelector('.ProseMirror table')
  await phone.tap('.ProseMirror table tr:nth-child(2) > :nth-child(1)')
  await wait(300)
  const phoneGrips = !!(await handle(phone, 'Column 1')) && !!(await handle(phone, 'Row 2'))
  step(`phone: tapping a cell shows its grips: ${phoneGrips}`, phoneGrips)
  await (await handle(phone, 'Row 2')).tap()
  await phone.waitForSelector('[role="menu"]')
  await wait(200)
  const m = await (await phone.$('[role="menu"]')).boundingBox()
  step(`phone: the row menu fits the screen (x=${Math.round(m.x)}..${Math.round(m.x + m.width)}, y=${Math.round(m.y)}..${Math.round(m.y + m.height)})`, m.x >= 0 && m.x + m.width <= 390 && m.y >= 0 && m.y + m.height <= 844)
  await phone.screenshot({ path: `${out}/tables-phone.png` })
  await phone.browserContext().close()

  await hoverCell(anna, 0, 0)
  await openMenu(anna, 'Table options')
  await choose(anna, 'Delete table')
  const gone = !(await anna.$('.ProseMirror table'))
  await anna.keyboard.down('Meta')
  await anna.keyboard.press('z')
  await anna.keyboard.up('Meta')
  await wait(300)
  step(`Delete table removes it (${gone}); ⌘Z brings it back (${await shape(anna)})`, gone && (await shape(anna)) === '5x4')
} finally {
  await anna.waitForFunction(() => !/Saving|Not saved/.test(document.querySelector('main header')?.textContent || ''), { timeout: 15000 }).catch(() => {})
  await wait(1000)
  await anna.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await anna.api('folio.api.pages.archive_page', { name: doc.name })
  await anna.api('folio.api.pages.delete_page', { name: doc.name })
  step(`cleaned up ${doc.name}`)
}
console.log('console errors:', errors.length ? errors : 'none')
if (errors.length) process.exitCode = 1
await browser.close()
