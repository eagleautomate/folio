// Browser test: the File block (/file): upload a PDF, open / download / preview it,
// drop a file onto a page, a failed upload, search, and who may open the file.
//   node e2e/files.mjs e2e/shots
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
const B = process.env.FOLIO_URL || 'http://localhost:8008'
const out = process.argv[2] || '.'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1360, height: 900 } })
const errors = []
const step = (s, ok = true) => {
  console.log(ok ? '✓' : '✗', s)
  if (!ok) process.exitCode = 1
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = Date.now()

async function session(usr) {
  const page = await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${B}/login`)
  await page.evaluate((usr) => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr, pwd: 'admin12345!' }) }), usr)
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  page.api = (method, args = {}) =>
    page.evaluate(async (method, args) => {
      const r = await fetch('/api/method/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token }, body: JSON.stringify(args) })
      return (await r.json()).message
    }, method, args)
  return page
}
const status = (page, url) => page.evaluate(async (url) => (await fetch(url)).status, url)
const saved = (page) => page.waitForFunction(() => !/Saving|Not saved/.test(document.querySelector('main header')?.textContent || ''), { timeout: 15000 })

// a real one-page PDF to upload
const pdfPath = path.resolve(out, `Q3-report-${stamp}.pdf`)
{
  const p = await browser.newPage()
  await p.setContent('<h1 style="font-family:sans-serif">Q3 report</h1><p>Revenue up 12%.</p>')
  await p.pdf({ path: pdfPath, format: 'A4' })
  await p.close()
}

const anna = await session('anna.keller@folio.test')
const sb = await anna.api('folio.api.workspace.get_sidebar')
// Leadership is private: Anna has Full Access, Marco can view, Luca isn't a member
const leadership = sb.spaces.find((s) => s.title === 'Leadership').name
const doc = await anna.api('folio.api.pages.create_page', { space: leadership, title: `Board pack ${stamp}` })

try {
  await anna.goto(`${B}/folio/p/${doc.name}`, { waitUntil: 'networkidle0' })
  await anna.waitForSelector('.ProseMirror')
  await anna.click('.ProseMirror')
  await anna.keyboard.type('/file')
  await anna.waitForSelector('xpath/.//button[.//span[text()="File"]]')
  const first = await anna.$eval('.max-h-80.w-72 button', (b) => b.textContent.trim())
  step(`/file: "File" is the first match (${first.slice(0, 40)})`, first.startsWith('File'))
  await anna.screenshot({ path: `${out}/files-slash.png` })
  await wait(300) // the menu re-renders as results settle; Enter must hit the final list
  const [chooser] = await Promise.all([anna.waitForFileChooser(), anna.keyboard.press('Enter')])
  await chooser.accept([pdfPath])
  await anna.waitForFunction(() => document.querySelector('.folio-file a[href*="/files/"]'), { timeout: 15000 })
  const card = await anna.$eval('.folio-file', (c) => ({ text: c.innerText.replace(/\s+/g, ' '), href: c.querySelector('a[href*="/files/"]').getAttribute('href'), download: !!c.querySelector('a[download]') }))
  step(`upload: card shows "${card.text}", links ${card.href}`, card.text.includes(`Q3-report-${stamp}.pdf`) && /PDF · \d+ KB/.test(card.text) && card.href.startsWith('/private/files/') && card.download)
  const head = await anna.evaluate(async (u) => {
    const r = await fetch(u)
    return { status: r.status, type: r.headers.get('content-type'), disposition: r.headers.get('content-disposition') }
  }, card.href)
  step(`the PDF opens (${head.status}, ${head.type}, ${head.disposition || 'inline'})`, head.status === 200 && head.type === 'application/pdf' && !/attachment/.test(head.disposition || ''))
  await anna.click('.folio-file button[aria-label="Preview"]')
  await anna.waitForSelector('.folio-file iframe')
  const frameSrc = await anna.$eval('.folio-file iframe', (f) => f.getAttribute('src'))
  step(`Preview shows the PDF inside the page: ${frameSrc === card.href}`, frameSrc === card.href)
  await wait(800)
  await anna.screenshot({ path: `${out}/files-pdf-preview.png` })

  // drop a spreadsheet onto the page: it becomes a file card too
  await anna.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['month,revenue\nJuly,120\n'], 'revenue.csv', { type: 'text/csv' }))
    const target = document.querySelector('.ProseMirror')
    const r = target.getBoundingClientRect()
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.bottom - 10 }))
  })
  await anna.waitForFunction(() => [...document.querySelectorAll('.folio-file')].some((c) => /revenue\.csv/.test(c.innerText) && c.querySelector('a[href*="/files/"]')), { timeout: 15000 })
  const csvText = await anna.$$eval('.folio-file', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' ')).find((t) => /revenue/.test(t)))
  step(`dropping a file adds a card: "${csvText}"`, /Spreadsheet/.test(csvText))
  const both = await anna.$$eval('.folio-file', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' ')))
  step(`the PDF card (selected by its Preview click) is kept, not replaced: ${both.length} cards`, both.length === 2 && both.some((t) => /Q3-report/.test(t)))

  // a failed upload removes its card and says why
  await anna.setRequestInterception(true)
  const fail = (req) => (req.url().includes('/api/method/upload_file') ? req.respond({ status: 417, contentType: 'application/json', body: JSON.stringify({ _server_messages: JSON.stringify([JSON.stringify({ message: 'File size exceeded the maximum allowed size' })]) }) }) : req.continue())
  anna.on('request', fail)
  const cardsBefore = await anna.$$eval('.folio-file', (c) => c.length)
  await anna.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], 'too-big.zip', { type: 'application/zip' }))
    const target = document.querySelector('.ProseMirror')
    const r = target.getBoundingClientRect()
    // ProseMirror ignores a drop without a position
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.bottom - 10 }))
  })
  await anna.waitForFunction(() => /too-big\.zip: File size exceeded/.test(document.body.innerText), { timeout: 10000 })
  await wait(300)
  const cardsAfter = await anna.$$eval('.folio-file', (c) => c.length)
  step(`failed upload: card removed (${cardsBefore} → ${cardsAfter}) and the error is shown`, cardsAfter === cardsBefore)
  anna.off('request', fail)
  await anna.setRequestInterception(false)

  // saved with the page; found by search
  await saved(anna)
  await wait(1000)
  await anna.reload({ waitUntil: 'networkidle0' })
  await anna.waitForSelector('.folio-file')
  const afterReload = await anna.$$eval('.folio-file', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' ')))
  step(`after reload both files are still there (${afterReload.length})`, afterReload.length === 2 && afterReload.every((t) => !/Uploading/.test(t)))
  const hits = await anna.api('folio.api.workspace.search', { query: `Q3-report-${stamp}` })
  step(`search finds the page by the file's name: ${hits.some((h) => h.name === doc.name)}`, hits.some((h) => h.name === doc.name))

  // who may open the file: page access decides
  const marco = await session('marco.rossi@folio.test')
  await marco.goto(`${B}/folio/p/${doc.name}`, { waitUntil: 'networkidle0' })
  await marco.waitForSelector('.folio-file a[download]')
  step(`Marco (can view Leadership) sees the card and can open the file: ${await status(marco, card.href)}`, (await status(marco, card.href)) === 200)
  await marco.screenshot({ path: `${out}/files-viewer.png` })
  const luca = await session('luca.meier@folio.test')
  const lucaStatus = await status(luca, card.href)
  step(`Luca (not in Leadership) can't download it even with the link: ${lucaStatus}`, lucaStatus === 403)
  await marco.browserContext().close()
  await luca.browserContext().close()
} finally {
  await saved(anna).catch(() => {})
  await anna.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await anna.api('folio.api.pages.archive_page', { name: doc.name })
  await anna.api('folio.api.pages.delete_page', { name: doc.name })
  const left = await anna.evaluate(async (name) => {
    const r = await fetch(`/api/method/frappe.client.get_count?doctype=File&filters=${encodeURIComponent(JSON.stringify({ attached_to_name: name }))}`)
    return (await r.json()).message
  }, doc.name)
  step(`cleaned up ${doc.name} (files left attached to it: ${left})`, left === 0)
  fs.rmSync(pdfPath, { force: true })
}
console.log('console errors:', errors.length ? errors : 'none')
if (errors.length) process.exitCode = 1
await browser.close()
