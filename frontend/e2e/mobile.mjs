// Browser test: collapsible sidebar on desktop, drawer + touch layout on a phone.
//   node e2e/mobile.mjs e2e/shots
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const errors = []
const step = (s, ok = true) => {
  console.log(ok ? '✓' : '✗', s)
  if (!ok) process.exitCode = 1
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(viewport, touch) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewport(viewport)
  if (touch) {
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' })
  }
  await page.goto(`${B}/login`)
  await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
  return page
}
const sidebarShown = (page) => page.$eval('aside:not([aria-label])', (a) => getComputedStyle(a).display !== 'none' && a.getBoundingClientRect().right > 0)
// nothing may make the page itself scroll sideways (tables and boards scroll inside their own box)
const noSideScroll = (page) => page.evaluate(() => [document.documentElement, document.body, document.querySelector('main')].every((el) => el.scrollWidth <= el.clientWidth + 1))
const pages = async (page) => (await page.evaluate(async () => (await (await fetch('/api/method/folio.api.workspace.get_sidebar')).json()).message.pages))

// ---------------- desktop: collapse
{
  const page = await open({ width: 1360, height: 860 })
  await page.evaluate(() => localStorage.removeItem('folio:sidebar-collapsed'))
  const doc = (await pages(page)).find((p) => p.title === 'Sprint 42 planning')
  await page.goto(`${B}/folio/p/${doc.name}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('main header')
  step(`desktop: sidebar shown by default: ${await sidebarShown(page)}`, await sidebarShown(page))
  const before = await page.$eval('main', (m) => m.clientWidth)
  await page.click('button[aria-label="Hide sidebar"]')
  await wait(200)
  const after = await page.$eval('main', (m) => m.clientWidth)
  step(`desktop: "Hide sidebar" hides it and the page gets wider (${before}px -> ${after}px)`, !(await sidebarShown(page)) && after > before)
  await page.screenshot({ path: `${out}/desktop-collapsed.png` })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('main header')
  step(`desktop: stays collapsed after reload: ${!(await sidebarShown(page))}`, !(await sidebarShown(page)))
  await page.click('main header button[aria-label="Show sidebar"]')
  await wait(200)
  step(`desktop: "Show sidebar" in the page header brings it back: ${await sidebarShown(page)}`, await sidebarShown(page))
  await page.keyboard.down('Meta')
  await page.keyboard.press('Backslash')
  await page.keyboard.up('Meta')
  await wait(200)
  const hiddenByKey = !(await sidebarShown(page))
  await page.keyboard.down('Control')
  await page.keyboard.press('Backslash')
  await page.keyboard.up('Control')
  await wait(200)
  step(`desktop: ⌘\\ hides it, Ctrl+\\ shows it: ${hiddenByKey && (await sidebarShown(page))}`, hiddenByKey && (await sidebarShown(page)))
  await page.click('button[aria-label="Hide sidebar"]')
  await page.goto(`${B}/folio/projects`, { waitUntil: 'networkidle0' })
  const floating = await page.$('main > button[aria-label="Show sidebar"]')
  step(`desktop: other screens (Projects) show the toggle too: ${!!floating}`, !!floating)
  await page.screenshot({ path: `${out}/desktop-projects-collapsed.png` })
  await page.evaluate(() => localStorage.removeItem('folio:sidebar-collapsed'))
  await page.browserContext().close()
}

// ---------------- phone
{
  const page = await open({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true)
  const hoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches)
  step(`phone: browser reports a touch screen (hover: none): ${hoverNone}`, hoverNone)
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('button[aria-label="Open menu"]')
  step(`phone: drawer closed on start, Home uses the full width: ${!(await sidebarShown(page))}`, !(await sidebarShown(page)))
  step(`phone: Home has no sideways scroll: ${await noSideScroll(page)}`, await noSideScroll(page))
  await page.screenshot({ path: `${out}/phone-home.png` })

  await page.tap('button[aria-label="Open menu"]')
  await wait(300)
  const box = await page.$eval('aside:not([aria-label])', (a) => a.getBoundingClientRect().toJSON())
  step(`phone: menu opens as a drawer over the page (x=${box.x}, width=${box.width})`, (await sidebarShown(page)) && box.x === 0 && box.width <= 390 * 0.85 + 1)
  const actions = await page.$$eval('aside [aria-label="Page actions"]', (bs) => bs.filter((b) => b.offsetParent).length)
  const rowHeight = await page.$eval('aside [draggable]', (r) => r.getBoundingClientRect().height)
  step(`phone: page "⋯" buttons visible without hover (${actions}) and rows are ${rowHeight}px tall`, actions > 0 && rowHeight >= 36)
  await page.screenshot({ path: `${out}/phone-drawer.png` })

  // backdrop and Escape close it
  await page.touchscreen.tap(360, 420) // the strip of page still visible right of the drawer
  await wait(300)
  const byBackdrop = !(await sidebarShown(page))
  await page.tap('button[aria-label="Open menu"]')
  await wait(300)
  await page.keyboard.press('Escape')
  await wait(300)
  step(`phone: tapping outside or Escape closes the drawer: ${byBackdrop && !(await sidebarShown(page))}`, byBackdrop && !(await sidebarShown(page)))

  // tapping a page in the drawer opens it and closes the drawer
  await page.tap('button[aria-label="Open menu"]')
  await wait(300)
  const [row] = await page.$$('xpath/.//aside//div[@draggable and .//span[normalize-space()="Sprint 42 planning"]]')
  await row.tap()
  await page.waitForSelector('main header')
  await wait(500)
  step(`phone: tapping a page opens it and closes the drawer: ${page.url().includes('/folio/p/') && !(await sidebarShown(page))}`, page.url().includes('/folio/p/') && !(await sidebarShown(page)))
  const crumbs = await page.$$eval('main header nav > *', (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent.trim()))
  step(`phone: breadcrumb shows only the current page: ${JSON.stringify(crumbs)}`, crumbs.length === 1)
  const title = await page.$eval('main textarea', (t) => ({ fits: t.scrollHeight <= t.clientHeight + 1, size: getComputedStyle(t).fontSize }))
  step(`phone: title fits (not clipped), font ${title.size}`, title.fits)
  const iconButtons = await page.$eval('main .group.relative > .flex.h-7', (d) => getComputedStyle(d).opacity)
  step(`phone: "Add icon / Add cover" visible without hover (opacity ${iconButtons})`, iconButtons === '1')
  const handle = await page.$eval('.folio-drag-handle', (h) => getComputedStyle(h).display).catch(() => 'none')
  step(`phone: editor drag handle hidden on touch (${handle})`, handle === 'none')
  step(`phone: page has no sideways scroll: ${await noSideScroll(page)}`, await noSideScroll(page))
  await page.screenshot({ path: `${out}/phone-page.png` })

  // a long title wraps and still fits after rotating
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await wait(300)
  const landscape = await page.$eval('main textarea', (t) => t.scrollHeight <= t.clientHeight + 1)
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await wait(300)
  const portrait = await page.$eval('main textarea', (t) => t.scrollHeight <= t.clientHeight + 1)
  step(`phone: title re-fits after rotating (landscape ${landscape}, portrait ${portrait})`, landscape && portrait)

  // search dialog fits the screen
  await page.tap('button[aria-label="Open menu"]')
  await wait(300)
  const [searchLink] = await page.$$('xpath/.//aside//button[.//span[normalize-space()="Search"]]')
  await searchLink.tap()
  const dlg = await page.waitForSelector('[role="dialog"]')
  await wait(300)
  const d = await dlg.boundingBox()
  const onTop = await page.evaluate(() => !!document.elementFromPoint(195, 200)?.closest('[role="dialog"]'))
  step(`phone: search dialog fits the screen (x=${Math.round(d.x)}, width=${Math.round(d.width)}), is on top, drawer closed: ${onTop && !(await sidebarShown(page))}`, d.x >= 0 && d.x + d.width <= 391 && onTop && !(await sidebarShown(page)))
  await page.screenshot({ path: `${out}/phone-search.png` })
  await page.keyboard.press('Escape')
  await wait(300)

  // editing on a phone: the / menu and the formatting toolbar fit the screen (throwaway page)
  const scratch = await page.evaluate(async () => {
    const h = { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }
    const sb = (await (await fetch('/api/method/folio.api.workspace.get_sidebar')).json()).message
    const space = sb.spaces.find((x) => x.title === 'Engineering').name
    const r = await fetch('/api/method/folio.api.pages.create_page', { method: 'POST', headers: h, body: JSON.stringify({ space, title: `Phone test ${Date.now()}` }) })
    return (await r.json()).message.name
  })
  await page.goto(`${B}/folio/p/${scratch}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.ProseMirror')
  await page.tap('.ProseMirror')
  await page.keyboard.type('Hello from a phone ')
  await page.keyboard.type('/')
  await wait(400)
  const slash = await page.$eval('.max-h-80.w-72', (m) => m.getBoundingClientRect().toJSON()).catch(() => null)
  step(`phone: the / menu fits the screen (${slash && `x=${Math.round(slash.x)}..${Math.round(slash.right)}`})`, !!slash && slash.x >= 0 && slash.right <= 391)
  await page.screenshot({ path: `${out}/phone-slash.png` })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Backspace')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Home')
  await page.keyboard.up('Shift')
  await wait(500)
  const bubble = await page.$eval('.bg-surface-elevation-2.shadow-xl', (m) => m.getBoundingClientRect().toJSON()).catch(() => null)
  step(`phone: the formatting toolbar fits the screen (${bubble && `x=${Math.round(bubble.x)}..${Math.round(bubble.right)}`})`, !!bubble && bubble.x >= 0 && bubble.right <= 391)
  await page.screenshot({ path: `${out}/phone-format.png` })
  // leave the page first (its autosave finishes), then trash + delete it, checking both calls
  await page.waitForFunction(() => !/Saving|Not saved/i.test(document.querySelector('main header')?.textContent || ''), { timeout: 10000 })
  await wait(1000) // after the 700ms autosave debounce
  await page.goto(`${B}/folio/p/${(await pages(page)).find((p) => p.title === 'Sprint 42 planning').name}`, { waitUntil: 'networkidle0' })
  const cleanup = await page.evaluate(async (name) => {
    const h = { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }
    const a = await fetch('/api/method/folio.api.pages.archive_page', { method: 'POST', headers: h, body: JSON.stringify({ name }) })
    const d = await fetch('/api/method/folio.api.pages.delete_page', { method: 'POST', headers: h, body: JSON.stringify({ name }) })
    return [a.status, d.status]
  }, scratch)
  step(`phone: cleaned up ${scratch} (${cleanup})`, cleanup.every((c) => c === 200))
  await page.waitForSelector('main header')

  // menus opened inside the drawer appear above it; space settings closes the drawer first
  await page.tap('button[aria-label="Open menu"]')
  await wait(300)
  const [treeRow] = await page.$$('xpath/.//aside//div[@draggable and .//span[normalize-space()="Sprint 42 planning"]]')
  await (await treeRow.$('button[aria-label="Page actions"]')).tap()
  const menu = await page.waitForSelector('[role="menu"]')
  await wait(300)
  const mb = await menu.boundingBox()
  const menuOnTop = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="menu"]'), { x: mb.x + 12, y: mb.y + mb.height / 2 })
  step(`phone: a page's ⋯ menu opens above the drawer, inside the screen: ${menuOnTop}`, menuOnTop && mb.x >= 0 && mb.x + mb.width <= 391)
  await page.screenshot({ path: `${out}/phone-drawer-menu.png` })
  await page.keyboard.press('Escape')
  await wait(300)
  step(`phone: Escape closes the menu but leaves the drawer open: ${!(await page.$('[role="menu"]')) && (await sidebarShown(page))}`, !(await page.$('[role="menu"]')) && (await sidebarShown(page)))
  const [spaceRow] = await page.$$('xpath/.//aside//section/div[1][.//span[normalize-space()="Engineering"]]')
  await (await spaceRow.$('button[aria-label="Engineering options"]')).tap()
  await page.waitForSelector('[role="menu"]')
  await wait(200)
  const items = await page.$$('[role="menuitem"]')
  const labels = await Promise.all(items.map((i) => i.evaluate((e) => e.textContent.trim())))
  await items[labels.findIndex((l) => /Space settings|About this space/.test(l))].tap()
  const sdlg = await page.waitForSelector('[role="dialog"]')
  await wait(400)
  const sb = await sdlg.boundingBox()
  const settingsOnTop = await page.evaluate(() => !!document.elementFromPoint(195, 300)?.closest('[role="dialog"]'))
  step(`phone: Space settings opens on top and fits (width ${Math.round(sb.width)}): ${settingsOnTop && !(await sidebarShown(page))}`, settingsOnTop && !(await sidebarShown(page)) && sb.x >= 0 && sb.x + sb.width <= 391)
  await page.screenshot({ path: `${out}/phone-space-settings.png` })
  await page.keyboard.press('Escape')
  await wait(300)

  // projects overview + a project's tasks board + task panel
  await page.goto(`${B}/folio/projects`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('table')
  step(`phone: Projects has no page-level sideways scroll (the table scrolls in its box): ${await noSideScroll(page)}`, await noSideScroll(page))
  await page.screenshot({ path: `${out}/phone-projects.png` })
  const nameCol = await page.$eval('table tbody tr td', (td) => td.getBoundingClientRect().width)
  step(`phone: project names get a usable column (${Math.round(nameCol)}px)`, nameCol >= 280)
  const project = (await pages(page)).find((p) => p.is_project_page && !['Completed', 'Cancelled'].includes(p.project_status))
  await page.goto(`${B}/folio/p/${project.name}?tab=tasks&view=board`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('section[data-column]')
  step(`phone: project board has no page-level sideways scroll: ${await noSideScroll(page)}`, await noSideScroll(page))
  await page.screenshot({ path: `${out}/phone-board.png` })
  await page.goto(`${B}/folio/p/${project.name}?tab=tasks&view=table`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('table tbody tr')
  const titleCol = await page.$eval('table tbody tr td:nth-child(2)', (td) => td.getBoundingClientRect().width)
  step(`phone: task titles get a usable column in Table view (${Math.round(titleCol)}px), page doesn't scroll sideways: ${await noSideScroll(page)}`, titleCol >= 240 && (await noSideScroll(page)))
  await page.screenshot({ path: `${out}/phone-task-table.png` })
  await page.goto(`${B}/folio/p/${project.name}?tab=tasks&view=board`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('section[data-column]')
  const card = await page.$('section[data-column] [draggable]')
  await card.tap()
  const panel = await page.waitForSelector('aside[aria-label="Task details"]')
  await wait(400)
  const pb = await panel.boundingBox()
  step(`phone: task panel fills the screen (x=${Math.round(pb.x)}, width=${Math.round(pb.width)})`, Math.round(pb.x) === 0 && Math.round(pb.width) === 390)
  await page.screenshot({ path: `${out}/phone-task-panel.png` })
  await page.browserContext().close()
}

console.log('console errors:', errors.length ? errors : 'none')
if (errors.length) process.exitCode = 1
await browser.close()
