// Browser smoke test against a running site with the demo data loaded.
//   yarn e2e                       (screenshots land in e2e/shots/)
//   FOLIO_URL=http://localhost:8008 CHROME_PATH=/path/to/chrome yarn e2e
// Creates one page as anna.keller@folio.test, checks slash menu, markdown
// shortcuts, autosave + reload and search, then deletes the page again.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 860 } })
const page = await browser.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const step = (s) => console.log('✓', s)

await page.goto(`${B}/login`)
await page.evaluate(async () => {
  await fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) })
})
await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
await page.waitForSelector('aside')
await page.screenshot({ path: `${out}/1-home.png` })
step('home loaded: ' + (await page.$eval('h1', (e) => e.textContent.trim())))

// open the welcome page from the sidebar
const [welcome] = await page.$$('xpath/.//aside//span[contains(., "Welcome to Folio")]')
await welcome.click()
await page.waitForSelector('.folio-prose')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${out}/2-welcome.png` })
step('welcome page rendered, blocks: ' + (await page.$$eval('.folio-prose > *', (n) => n.length)))

// create a new page in Company Wiki via the space "+" button
const spaceHeader = (await page.$$('xpath/.//aside//section[.//span[text()="Company Wiki"]]/div[1]'))[0]
await spaceHeader.hover()
const before = page.url()
await (await spaceHeader.$('button[aria-label="New page in this space"]')).click()
await page.waitForFunction((b) => location.href !== b, {}, before)
// the new page's empty title gets focus once it has loaded
await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA' && document.activeElement.value === '')
const url = page.url()
await page.keyboard.type('E2E test page')
await page.keyboard.press('Enter')
await page.keyboard.type('/head')
try {
  await page.waitForSelector('xpath/.//button[.//span[text()="Heading 2"]]', { timeout: 4000 })
} catch (e) {
  await page.screenshot({ path: `${out}/fail.png` })
  console.log('active:', await page.evaluate(() => document.activeElement?.className + ' | ' + document.querySelector('.folio-prose')?.innerHTML.slice(0, 300)))
  console.log('console errors:', errors)
  process.exit(1)
}
await page.screenshot({ path: `${out}/3-slash.png` })
await page.keyboard.press('ArrowDown')
await page.keyboard.press('Enter')
await page.keyboard.type('Saved heading')
await page.keyboard.press('Enter')
await page.keyboard.type('[] a checklist item')
await new Promise((r) => setTimeout(r, 2000))
step('status: ' + (await page.$eval('header', (h) => h.innerText.replace(/\s+/g, ' '))))

await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('.folio-prose h2')
const persisted = await page.evaluate(() => ({
  title: document.querySelector('textarea').value,
  h2: document.querySelector('.folio-prose h2')?.textContent,
  todo: document.querySelector('.folio-prose ul[data-type=taskList]')?.textContent.trim(),
  sidebar: [...document.querySelectorAll('aside span')].some((s) => s.textContent === 'E2E test page'),
}))
step('after reload: ' + JSON.stringify(persisted))
await page.screenshot({ path: `${out}/4-saved.png` })

// search
await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta')
await page.waitForSelector('input[placeholder="Search pages…"]')
await page.type('input[placeholder="Search pages…"]', 'runbook')
await new Promise((r) => setTimeout(r, 800))
step('search results: ' + (await page.$$eval('[role=dialog] button span.font-medium', (n) => n.map((x) => x.textContent))))
await page.screenshot({ path: `${out}/5-search.png` })

// clean up: trash + delete the test page via API
const name = url.split('/p/')[1]
await page.evaluate(async (name) => {
  const h = { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }
  await fetch('/api/method/folio.api.pages.archive_page', { method: 'POST', headers: h, body: JSON.stringify({ name }) })
  await fetch('/api/method/folio.api.pages.delete_page', { method: 'POST', headers: h, body: JSON.stringify({ name }) })
}, name)
step('cleaned up ' + name)
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
