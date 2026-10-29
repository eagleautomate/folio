// Regenerates the README screenshots in docs/screenshots/ from the demo site.
//   node e2e/screenshots.mjs ../docs/screenshots
// Creates a showcase project ("Customer Portal Launch") with tasks, a notes page and a
// temporary restricted user, takes the pictures, then deletes all of it again.
import puppeteer from 'puppeteer-core'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '../docs/screenshots'
const W = { width: 1440, height: 900, deviceScaleFactor: 1.5 }
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: W })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shots = []
const errors = []

async function session(usr, pwd) {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${B}/login`)
  await page.evaluate(({ usr, pwd }) => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr, pwd }) }), { usr, pwd })
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  page.api = async (method, args = {}) => {
    const res = await page.evaluate(async (method, args) => {
      const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
      return { ok: r.ok, body: await r.json() }
    }, method, args)
    if (!res.ok) throw new Error(`${method}: ${res.body._server_messages || res.body.exception}`)
    return res.body.message
  }
  return page
}
async function shot(page, name, clip) {
  await sleep(500)
  await page.screenshot({ path: `${out}/${name}.png`, ...(clip && { clip }) })
  shots.push(name)
}
async function go(page, path, wait, { scrollToTabs = false } = {}) {
  await page.goto(`${B}${path}`, { waitUntil: 'networkidle0' })
  if (wait) await page.waitForSelector(wait)
  if (scrollToTabs) {
    // skip the cover so the task views are in the picture
    await page.evaluate(() => {
      const nav = document.querySelector('nav[role="tablist"]')
      nav.closest('.overflow-y-auto').scrollTop = nav.offsetTop - 170
    })
  }
  await sleep(400)
}
// keep the user's own test pages out of the pictures (screenshot browser only)
async function collapseWiki(page, wiki) {
  await page.evaluate((w) => localStorage.setItem('folio:collapsed-spaces', JSON.stringify({ [w]: true })), wiki)
}

const anna = await session('anna.keller@folio.test', 'admin12345!')
const sb = await anna.api('folio.api.workspace.get_sidebar')
const wiki = sb.spaces.find((s) => s.title === 'Company Wiki').name
await collapseWiki(anna, wiki)

// ---- showcase data
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const created = { tasks: [], pages: [], users: [] }
const project = await anna.api('folio.api.projects.create_project', { project_name: 'Customer Portal Launch', expected_start_date: day(-20), expected_end_date: day(45), priority: 'High' })
const projectPage = project.page
const people = { anna: 'anna.keller@folio.test', luca: 'luca.meier@folio.test', sophie: 'sophie.brunner@folio.test', elena: 'elena.weber@folio.test', jonas: 'jonas.huber@folio.test' }
const TASKS = [
  ['Interview five pilot customers', 'Completed', 'elena', 'Medium', -12],
  ['Write the portal requirements', 'Completed', 'anna', 'High', -6],
  ['Design login and dashboard screens', 'Pending Review', 'sophie', 'High', 4],
  ['Build invoice download page', 'Working', 'luca', 'Urgent', 7],
  ['Set up single sign-on', 'Working', 'jonas', 'High', 10],
  ['Connect order status from ERPNext', 'Open', 'luca', 'Medium', 14],
  ['Write help articles', 'Open', 'elena', 'Low', 21],
  ['Migrate customer contacts', 'Open', 'sophie', 'Medium', -2],
  ['Security review', 'Open', 'jonas', 'High', 25],
  ['Launch announcement email', 'Open', 'anna', 'Medium', 30],
]
for (const [subject, status, who, priority, due] of TASKS) {
  const t = await anna.api('folio.api.tasks.create_task', { page: projectPage, subject })
  created.tasks.push(t.name)
  await anna.api('folio.api.tasks.set_assignees', { name: t.name, users: JSON.stringify([people[who]]) })
  await anna.api('folio.api.tasks.update_task', { name: t.name, priority, exp_end_date: day(due), ...(status !== 'Open' && { status }) })
}
const overview = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goal' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Give our B2B customers one place to see their orders, download invoices and raise questions, so our team answers fewer "where is my order?" emails.' }] },
    { type: 'callout', attrs: { emoji: '🎯' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Success: 30% fewer order-status emails within two months of launch.' }] }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decisions' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Customers log in with their work email (single sign-on).' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Invoices come straight from ERPNext, no copies.' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Owner: ' }, { type: 'mention', attrs: { id: people.anna, label: 'Anna Keller' } }] }] },
    ] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'This week' }] },
    { type: 'erpnextTask', attrs: { task: created.tasks[3], subject: 'Build invoice download page' } },
    { type: 'erpnextTask', attrs: { task: created.tasks[4], subject: 'Set up single sign-on' } },
  ],
}
await anna.api('folio.api.pages.save_content', { name: projectPage, content: JSON.stringify(overview), title: 'Customer Portal Launch' })
await anna.api('folio.api.pages.update_page', { name: projectPage, icon: '🚀', cover: 'linear-gradient(135deg, #a5f3fc 0%, #818cf8 100%)' })

const notes = await anna.api('folio.api.pages.create_page', {
  space: wiki,
  title: 'Weekly team meeting',
  icon: '🗓️',
  content: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Attendees: ' }, { type: 'mention', attrs: { id: people.anna, label: 'Anna Keller' } }, { type: 'text', text: ' ' }, { type: 'mention', attrs: { id: people.luca, label: 'Luca Meier' } }, { type: 'text', text: ' ' }, { type: 'mention', attrs: { id: people.elena, label: 'Elena Weber' } }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Updates' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The customer portal is on track. ' }, { type: 'text', text: 'Single sign-on', marks: [{ type: 'bold' }] }, { type: 'text', text: ' needs one more week.' }] },
      { type: 'erpnextProject', attrs: { project: project.project } },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action items' }] },
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Share interview notes with the team' }] }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Book the security review' }] }] },
      ] },
      { type: 'paragraph' },
    ],
  },
})
created.pages.push(notes.name)

try {
  // 1. hero: project page overview
  await go(anna, `/folio/p/${projectPage}`, '.folio-prose h2')
  await anna.waitForFunction(() => document.querySelectorAll('.folio-task a[href^="/desk/task/"]').length === 2)
  await shot(anna, '01-project-page')

  // 2. tasks: list, board (status, assignee), table, panel
  await go(anna, `/folio/p/${projectPage}?tab=tasks`, 'input[placeholder^="Add a task"]', { scrollToTabs: true })
  await shot(anna, '02-tasks-list')
  await go(anna, `/folio/p/${projectPage}?tab=tasks&view=board`, 'section[data-column="Working"]', { scrollToTabs: true })
  await shot(anna, '03-board-status')
  await go(anna, `/folio/p/${projectPage}?tab=tasks&view=board&group=assignee`, 'section[data-column="__none"]', { scrollToTabs: true })
  await shot(anna, '04-board-assignee')
  await go(anna, `/folio/p/${projectPage}?tab=tasks&view=table`, 'tbody tr', { scrollToTabs: true })
  await shot(anna, '05-table')
  await go(anna, `/folio/p/${projectPage}?tab=tasks&view=board&task=${created.tasks[3]}`, 'aside[aria-label="Task details"] textarea', { scrollToTabs: true })
  await shot(anna, '06-task-panel')

  // 3. projects overview
  await go(anna, '/folio/projects', 'tbody tr')
  await shot(anna, '07-projects-table')
  await go(anna, '/folio/projects?view=board', 'section[data-column="Open"]')
  await shot(anna, '08-projects-board')

  // 4. editor: a notes page, slash menu, formatting toolbar
  await go(anna, `/folio/p/${notes.name}`, '.folio-project a')
  await anna.waitForFunction(() => /open tasks/.test(document.querySelector('.folio-project').innerText))
  await shot(anna, '09-notes-page')
  await anna.click('.folio-prose > p:last-child')
  await anna.keyboard.type('/')
  await anna.waitForSelector('xpath/.//button[.//span[text()="Heading 1"]]')
  await shot(anna, '10-slash-menu')
  await anna.keyboard.press('Escape')
  await anna.keyboard.press('Backspace')
  await anna.evaluate(() => {
    const strong = document.querySelector('.folio-prose strong')
    const range = document.createRange()
    range.selectNodeContents(strong.parentElement)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await sleep(400)
  await shot(anna, '11-formatting-toolbar')

  // 5. search
  await go(anna, '/folio/projects', 'tbody tr')
  await anna.keyboard.down('Meta'); await anna.keyboard.press('k'); await anna.keyboard.up('Meta')
  await anna.waitForSelector('input[placeholder="Search pages…"]')
  await anna.type('input[placeholder="Search pages…"]', 'portal')
  await sleep(700)
  await shot(anna, '12-search')
  await anna.keyboard.press('Escape')

  // 6. space settings: members
  await go(anna, '/folio', 'aside')
  const [header] = await anna.$$('xpath/.//aside//section/div[1][.//span[normalize-space()="Engineering"]]')
  await header.hover()
  await (await header.$('button[aria-label="Engineering options"]')).click()
  await (await anna.waitForSelector('xpath/.//*[@role="menuitem" and contains(., "Manage members")]')).click()
  await anna.waitForSelector('select[aria-label^="Access for"]')
  await shot(anna, '13-space-members')
  await anna.keyboard.press('Escape')

  // 7. access: a user limited to one project by an ERPNext User Permission
  const admin = await session('Administrator', 'admin')
  const limited = `pilot-user-${Date.now().toString().slice(-5)}@folio.test`
  await admin.api('frappe.client.insert', { doc: { doctype: 'User', email: limited, first_name: 'Pilot', last_name: 'User', send_welcome_email: 0, new_password: 'Folio-demo-12345!', roles: [{ role: 'Folio User' }, { role: 'Projects User' }] } })
  created.users.push(limited)
  await admin.api('frappe.client.insert', { doc: { doctype: 'User Permission', user: limited, allow: 'Project', for_value: project.project, apply_to_all_doctypes: 1 } })
  const pilot = await session(limited, 'Folio-demo-12345!')
  await collapseWiki(pilot, wiki)
  await go(pilot, '/folio/projects?scope=all', 'tbody tr')
  await shot(pilot, '14-limited-user')
  const other = sb.pages.find((p) => p.title === 'ERP Rollout Phase 2' && p.is_project_page)
  await go(pilot, `/folio/p/${other.name}`)
  await pilot.waitForFunction(() => /isn't available/.test(document.body.innerText))
  await shot(pilot, '15-limited-user-blocked')
  created.admin = admin
} finally {
  const admin = created.admin || (await session('Administrator', 'admin'))
  // users first: their User Permission on the project would block deleting it
  for (const u of created.users) await admin.api('frappe.client.delete', { doctype: 'User', name: u }).catch((e) => errors.push(String(e)))
  for (const t of created.tasks) await admin.api('frappe.client.delete', { doctype: 'Task', name: t }).catch((e) => errors.push(String(e)))
  await admin.api('frappe.client.delete', { doctype: 'Project', name: project.project }).catch((e) => errors.push(String(e)))
  for (const p of [projectPage, ...created.pages]) {
    await admin.api('folio.api.pages.archive_page', { name: p }).catch(() => {})
    await admin.api('folio.api.pages.delete_page', { name: p }).catch((e) => errors.push(String(e)))
  }
}
console.log('screenshots:', shots.join(', '))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
