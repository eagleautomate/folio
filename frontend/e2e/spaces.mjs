// Browser test for the space settings dialog. Needs demo data.
//   node e2e/spaces.mjs e2e/shots
// As anna.keller@folio.test on a throwaway space: rename + icon + private, add /
// change / remove a member, the last-owner guard, delete. Then as marco.rossi
// (Can Edit on Company Wiki, not an owner): settings are read-only.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
let page = await browser.newPage()
const errors = []
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
}
watch(page)
const step = (s) => console.log('✓', s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const api = (method, args = {}) =>
  page.evaluate(async (method, args) => {
    const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
    return (await r.json()).message
  }, method, args)
const login = async (usr) => {
  await page.goto(`${B}/login`)
  await page.evaluate((usr) => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr, pwd: 'admin12345!' }) }), usr)
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
}
const openMenu = async (title, item) => {
  const [header] = await page.$$(`xpath/.//aside//section/div[1][.//span[normalize-space()="${title}"]]`)
  await header.hover()
  await (await header.$(`button[aria-label="${title} options"]`)).click()
  await (await page.waitForSelector(`xpath/.//*[@role="menuitem" and contains(., "${item}")]`)).click()
  await page.waitForSelector('[role="dialog"] [role="tablist"]')
  await sleep(400)
}
const clickText = async (sel, text) => (await page.$$(`xpath/.//${sel}[contains(normalize-space(), "${text}")]`))[0].click()
const dialogText = () => page.$eval('[role="dialog"]', (d) => d.innerText.replace(/\s+/g, ' '))

await login('anna.keller@folio.test')
const stamp = Date.now().toString().slice(-5)
const original = `E2E Space ${stamp}`
const renamed = `E2E Renamed ${stamp}`
const created = await api('folio.api.spaces.create_space', { title: original, icon: '📁', visibility: 'Workspace' })
await page.reload({ waitUntil: 'networkidle0' })
let deleted = false
try {
  // General: rename, icon, description, private
  await openMenu(original, 'Space settings')
  const name = await page.$('xpath/.//*[@role="dialog"]//label[contains(., "Name")]//input | //*[@role="dialog"]//input[@type="text"]')
  await name.click({ clickCount: 3 })
  await page.keyboard.type(renamed)
  await page.type('[role="dialog"] textarea', 'Space for the e2e test')
  await page.click('[role="dialog"] input[type=radio][value="Private"]')
  await page.click('[role="dialog"] button[aria-label="Space icon"]')
  await (await page.waitForSelector('xpath/.//button[normalize-space()="🧪"]')).click()
  step('General form shows "Unsaved changes": ' + (await dialogText()).includes('Unsaved changes'))
  await page.screenshot({ path: `${out}/space-general.png` })
  await clickText('button', 'Save')
  await page.waitForFunction((t) => [...document.querySelectorAll('aside span')].some((s) => s.textContent.trim() === t), {}, renamed)
  const saved = await api('folio.api.spaces.get_space', { name: created.name })
  step(`saved: "${saved.title}" ${saved.icon} ${saved.visibility}; sidebar shows the new name`)

  // Members: add Luca as Can View, change to Can Edit, remove
  await clickText('button[@role="tab"]', 'Members')
  await page.type('input[aria-label="Add member"]', 'luca')
  await page.waitForSelector('xpath/.//*[@role="dialog"]//button[contains(., "luca.meier@folio.test")]')
  await page.select('select[aria-label="Access for new member"]', 'Can View')
  await page.keyboard.press('Enter')
  await page.waitForSelector('select[aria-label="Access for Luca Meier"]')
  step('added Luca: ' + JSON.stringify((await api('folio.api.spaces.get_space', { name: created.name })).members.map((m) => `${m.user}:${m.access}`)))
  await page.select('select[aria-label="Access for Luca Meier"]', 'Can Edit')
  await page.waitForFunction(async () => true)
  await sleep(800)
  step('Luca now: ' + (await api('folio.api.spaces.get_space', { name: created.name })).members.find((m) => m.user.startsWith('luca')).access)
  await page.screenshot({ path: `${out}/space-members.png` })

  // last owner can't step down
  await page.select('select[aria-label="Access for Anna Keller"]', 'Can Edit')
  await page.waitForFunction(() => /at least one member with Full Access/.test(document.body.innerText), { timeout: 8000 })
  const anna = (await api('folio.api.spaces.get_space', { name: created.name })).members.find((m) => m.user.startsWith('anna'))
  await sleep(500)
  const shown = await page.$eval('select[aria-label="Access for Anna Keller"]', (sel) => sel.value)
  step(`last owner guard: message shown, Anna still ${anna.access}, dropdown shows ${shown}`)
  errors.splice(0) // that refusal (HTTP 417) was expected

  await page.click('button[aria-label="Remove Luca Meier"]')
  await (await page.waitForSelector('xpath/.//button[normalize-space()="Remove"]')).click()
  await page.waitForFunction(() => !document.querySelector('select[aria-label="Access for Luca Meier"]'))
  await page.waitForFunction(() => !/Remove Luca Meier\?/.test(document.body.innerText)) // confirm dialog gone
  await sleep(300)
  step('removed Luca')

  // delete
  await clickText('button[@role="tab"]', 'General')
  await clickText('button', 'Delete space…')
  await (await page.waitForSelector('xpath/.//button[normalize-space()="Delete space"]')).click()
  await page.waitForFunction((t) => ![...document.querySelectorAll('aside span')].some((s) => s.textContent.trim() === t), {}, renamed)
  deleted = !(await api('frappe.client.get_count', { doctype: 'Folio Space', filters: { name: created.name } }))
  step(`deleted: gone from sidebar and database: ${deleted}`)
} finally {
  if (!deleted) await api('folio.api.spaces.delete_space', { name: created.name })
}

// read-only for a non-owner (own browser context, so Anna's session isn't reused)
await page.close()
page = await (await browser.createBrowserContext()).newPage()
watch(page)
await login('marco.rossi@folio.test')
await openMenu('Company Wiki', 'About this space')
const text = await dialogText()
const disabled = await page.$eval('[role="dialog"] fieldset', (f) => f.disabled)
step(`Marco (not an owner): read-only note ${text.includes('Only members with Full Access')}, form disabled ${disabled}, no Save/Delete ${!text.includes('Delete space')}`)
await page.screenshot({ path: `${out}/space-readonly.png` })
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
