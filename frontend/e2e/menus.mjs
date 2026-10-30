// Browser test: sidebar "⋯" menus open next to their row, not in the top-left corner.
//   node e2e/menus.mjs e2e/shots
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const step = (s) => console.log('✓', s)
await page.goto(`${B}/login`)
await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
await page.waitForSelector('aside')

async function check(label, rowHandle, buttonSelector, name) {
  await rowHandle.hover()
  const button = await rowHandle.$(buttonSelector)
  await button.click()
  const menu = await page.waitForSelector('[role="menu"]')
  await page.mouse.move(700, 600) // pointer leaves the row, as a person moving to the menu would
  await new Promise((r) => setTimeout(r, 400))
  const row = await rowHandle.boundingBox()
  const box = await menu.boundingBox()
  const near = Math.abs(box.y - (row.y + row.height)) < 40 || Math.abs(box.y + box.height - row.y) < 40
  step(`${label}: row at y=${Math.round(row.y)}, menu at x=${Math.round(box.x)} y=${Math.round(box.y)} -> next to the row: ${near && box.x > 0}`)
  await page.screenshot({ path: `${out}/menu-${name}.png` })
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 300))
  if (!near) process.exitCode = 1
}

const [pageRow] = await page.$$('xpath/.//aside//div[contains(@class,"group") and .//span[normalize-space()="Sprint 42 planning"]]')
await check('page "Sprint 42 planning"', pageRow, 'button[aria-label="Page actions"]', 'page')
const [spaceRow] = await page.$$('xpath/.//aside//section/div[1][.//span[normalize-space()="Leadership"]]')
await check('space "Leadership"', spaceRow, 'button[aria-label="Leadership options"]', 'space')
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
