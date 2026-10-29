// Browser test: project pages follow ERPNext's Project permissions (needs ERPNext + demo data).
//   node e2e/access.mjs e2e/shots
// As Administrator, creates two throwaway users:
//   none@  Folio User only (no Project permission)
//   one@   Projects User + a User Permission limiting them to Website Relaunch
// then signs in as each (own browser context) and checks sidebar, overview and direct
// links. Deletes both users at the end.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const errors = []
const failed = [] // HTTP errors: refusals are expected here, anything else is not
const step = (s) => console.log('✓', s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = Date.now().toString().slice(-6)
const NONE = `access-none-${stamp}@folio.test`
const ONE = `access-one-${stamp}@folio.test`
const PASSWORD = 'Folio-e2e-12345!'

async function session(usr, pwd) {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`${usr}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${usr}: pageerror ${e.message}`))
  page.on('response', async (r) => {
    if (r.status() < 400) return
    let why = ''
    try {
      why = JSON.parse(JSON.parse((await r.json())._server_messages)[0]).message.replace(/<[^>]+>/g, '').slice(0, 160)
    } catch {
      // no server message
    }
    failed.push(`${usr} ${r.status()} ${r.url().replace(B, '')} ${why}`)
  })
  await page.goto(`${B}/login`)
  await page.evaluate(({ usr, pwd }) => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr, pwd }) }), { usr, pwd })
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('aside')
  page.api = (method, args = {}) =>
    page.evaluate(async (method, args) => {
      const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
      return (await r.json()).message
    }, method, args)
  return page
}
const sidebarProjects = (page) =>
  page.$$eval('aside section', (secs) => {
    const s = secs.find((x) => [...x.querySelectorAll(':scope > div:first-child span')].some((e) => e.textContent.trim() === 'Projects'))
    return s ? [...s.querySelectorAll('span.truncate')].map((e) => e.textContent.trim()).filter((t) => t !== 'Projects') : []
  })

const admin = await session('Administrator', 'admin')
const sb = await admin.api('folio.api.workspace.get_sidebar')
const rollout = sb.pages.find((p) => p.title === 'ERP Rollout Phase 2' && p.is_project_page)
const relaunch = sb.pages.find((p) => p.title === 'Website Relaunch' && p.is_project_page)
for (const [email, roles] of [[NONE, ['Folio User']], [ONE, ['Folio User', 'Projects User']]]) {
  await admin.api('frappe.client.insert', { doc: { doctype: 'User', email, first_name: email.split('@')[0], send_welcome_email: 0, new_password: PASSWORD, roles: roles.map((role) => ({ role })) } })
}
await admin.api('frappe.client.insert', { doc: { doctype: 'User Permission', user: ONE, allow: 'Project', for_value: relaunch.project, apply_to_all_doctypes: 1 } })
step(`created ${NONE} and ${ONE} (User Permission -> ${relaunch.project})`)

try {
  // --- no Project permission
  const none = await session(NONE, PASSWORD)
  step(`no-roles user, Projects space in sidebar: [${(await sidebarProjects(none)).join(', ')}]`)
  step(`no-roles user sees "All projects" link: ${await none.$$eval('aside div', (d) => d.some((e) => e.textContent.trim() === 'All projects'))}`)
  await none.goto(`${B}/folio/projects`, { waitUntil: 'networkidle0' })
  await sleep(500)
  step('no-roles user on /folio/projects: "' + (await none.evaluate(() => document.querySelector('main').innerText.match(/You don't have access[^.]*\./)?.[0] || 'no message')) + '"')
  await none.goto(`${B}/folio/p/${rollout.name}`, { waitUntil: 'networkidle0' })
  await none.waitForFunction(() => /isn't available/.test(document.body.innerText))
  step('no-roles user opening ERP Rollout link: "This page isn\'t available"')
  await none.screenshot({ path: `${out}/access-none.png` })

  // --- User Permission limits to Website Relaunch
  const one = await session(ONE, PASSWORD)
  step(`restricted user, Projects space in sidebar: [${(await sidebarProjects(one)).join(', ')}]`)
  await one.goto(`${B}/folio/projects?scope=all`, { waitUntil: 'networkidle0' })
  await one.waitForSelector('tbody tr')
  step(`restricted user, All projects: [${await one.$$eval('tbody tr td:first-child div:first-child', (e) => e.map((x) => x.textContent.trim()).join(', '))}]`)
  await one.goto(`${B}/folio/p/${rollout.name}`, { waitUntil: 'networkidle0' })
  await one.waitForFunction(() => /isn't available/.test(document.body.innerText))
  step('restricted user opening ERP Rollout link: "This page isn\'t available"')
  await one.goto(`${B}/folio/p/${relaunch.name}?tab=tasks`, { waitUntil: 'networkidle0' })
  await one.waitForSelector('input[placeholder^="Add a task to this project"]')
  step(`restricted user on Website Relaunch: Tasks tab with ${await one.$$eval('.divide-y > *', (r) => r.length)} open tasks, can add tasks`)
  await one.screenshot({ path: `${out}/access-one.png` })
  const hits = await one.api('folio.api.workspace.search', { query: 'Rollout' })
  step(`restricted user searching "Rollout": ${hits.length} results`)
} finally {
  for (const email of [NONE, ONE]) {
    // frappe.client.get_list ignores `pluck`: it returns [{ name }]
    const ups = (await admin.api('frappe.client.get_list', { doctype: 'User Permission', filters: { user: email } })) || []
    for (const up of ups) await admin.api('frappe.client.delete', { doctype: 'User Permission', name: up.name })
    await admin.api('frappe.client.delete', { doctype: 'User', name: email })
  }
  step('deleted both test users')
}
const EXPECTED = [/403 \/api\/method\/folio\.api\.projects\.list_projects/, /403 \/api\/method\/folio\.api\.pages\.get_page/]
const unexpected = failed.filter((f) => !EXPECTED.some((re) => re.test(f)))
step(`${failed.length - unexpected.length} expected refusals (403); unexpected failed requests: ${unexpected.length ? JSON.stringify(unexpected) : 'none'}`)
// the browser logs every refused request as "Failed to load resource"; those are the refusals above
const realErrors = errors.filter((e) => !/Failed to load resource: .*403/.test(e))
console.log('console errors:', realErrors.length ? realErrors : 'none')
await browser.close()
