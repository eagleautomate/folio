// Browser test: Folio as a home-screen app (PWA) and the "Add to Home Screen" guide.
//   node e2e/install.mjs e2e/shots
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
const iOS = '(iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const UA = {
  safari: `Mozilla/5.0 ${iOS} Version/18.5 Mobile/15E148 Safari/604.1`,
  chrome: `Mozilla/5.0 ${iOS} CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1`,
  instagram: `Mozilla/5.0 ${iOS} Mobile/15E148 Instagram 380.0.0.29.109 (iPhone15,2; iOS 18_5; en_US)`,
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
}
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }

async function open({ ua, viewport = PHONE, standalone = false, before, normalWindow = false } = {}) {
  // separate contexts are private windows, where Chrome never offers to install
  const page = normalWindow ? await browser.newPage() : await (await browser.createBrowserContext()).newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  if (ua) await page.setUserAgent(ua)
  await page.setViewport(viewport)
  if (viewport.hasTouch) await (await page.createCDPSession()).send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  // launched from the Home Screen: iOS sets navigator.standalone
  if (standalone) await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'standalone', { get: () => true }))
  if (before) await page.evaluateOnNewDocument(before)
  await page.goto(`${B}/login`)
  await page.evaluate(() => fetch('/api/method/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usr: 'anna.keller@folio.test', pwd: 'admin12345!' }) }))
  await page.goto(`${B}/folio`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('main')
  await wait(2000) // the guide waits 1.5s after load
  return page
}
const sheet = (page) => page.$('section[aria-label="Add Folio to your Home Screen"]')
const sheetText = async (page) => (await sheet(page)) && page.$eval('section[aria-label="Add Folio to your Home Screen"]', (s) => s.innerText.replace(/\s+/g, ' '))
async function userMenuLabels(page) {
  if (await page.$('button[aria-label="Open menu"]')) {
    await page.tap('button[aria-label="Open menu"]')
    await wait(300)
  }
  await page.click('aside:not([aria-label]) > div:first-child button')
  await page.waitForSelector('[role="menuitem"]')
  const labels = await page.$$eval('[role="menuitem"]', (items) => items.map((i) => i.textContent.trim()))
  return labels
}

// ---- the app is installable: manifest, icons, iOS tags
{
  const page = await open({ viewport: { width: 1360, height: 860 }, normalWindow: true })
  const cdp = await page.createCDPSession()
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  const manifest = await cdp.send('Page.getAppManifest')
  step(`Chrome: installable, no errors (${JSON.stringify(installabilityErrors)}), manifest parsed without errors`, !installabilityErrors.length && !manifest.errors.length)
  const head = await page.evaluate(async () => {
    const q = (s) => document.querySelector(s)
    const m = await (await fetch(q('link[rel="manifest"]').href)).json()
    const icons = await Promise.all([q('link[rel="apple-touch-icon"]').href, ...m.icons.map((i) => i.src)].map(async (u) => (await fetch(u)).status))
    return {
      capable: q('meta[name="apple-mobile-web-app-capable"]')?.content,
      title: q('meta[name="apple-mobile-web-app-title"]')?.content,
      cover: q('meta[name="viewport"]').content.includes('viewport-fit=cover'),
      m: { display: m.display, start: m.start_url, scope: m.scope },
      icons,
    }
  })
  step(`iOS tags: capable=${head.capable}, title=${head.title}, viewport-fit=cover ${head.cover}`, head.capable === 'yes' && head.title === 'Folio' && head.cover)
  step(`manifest: ${JSON.stringify(head.m)}; icons ${head.icons}`, head.m.display === 'standalone' && head.m.start === '/folio' && head.m.scope === '/' && head.icons.every((s) => s === 200))
  const pad = await page.$eval('.folio-safe', (e) => getComputedStyle(e).padding)
  step(`desktop: no guide, and safe-area padding is 0 outside a phone (${pad})`, !(await sheet(page)) && pad === '0px')
  const labels = await userMenuLabels(page)
  // desktop Chrome offers to install real (non-private) windows: a menu item, never a pop-up
  step(`desktop Chrome: "Install app" in the user menu, no pop-up (${labels.join(', ')})`, labels.includes('Install app') && !labels.includes('Add to Home Screen'))
  await page.evaluate(() => fetch('/api/method/logout', { method: 'POST', headers: { 'X-Frappe-CSRF-Token': window.csrf_token } }))
  await page.close()
}

// ---- iPhone Safari: the guide, "Not now", and reopening from the user menu
{
  const page = await open({ ua: UA.safari })
  const text = await sheetText(page)
  step(`iPhone Safari: guide appears: "${text?.slice(0, 70)}…"`, !!text && /Share/.test(text) && /Safari's toolbar/.test(text) && /Add to Home Screen/.test(text) && /sign in once more/.test(text))
  const box = await (await sheet(page)).boundingBox()
  step(`iPhone Safari: guide is a sheet at the bottom, inside the screen (y=${Math.round(box.y)}..${Math.round(box.y + box.height)}, width ${Math.round(box.width)})`, box.x >= 0 && box.x + box.width <= 391 && Math.round(box.y + box.height) === 844)
  await page.screenshot({ path: `${out}/install-ios-safari.png` })
  const [notNow] = await page.$$('xpath/.//section[@aria-label="Add Folio to your Home Screen"]//button[normalize-space()="Not now"]')
  await notNow.tap()
  await wait(400)
  step(`iPhone Safari: "Not now" closes it: ${!(await sheet(page))}`, !(await sheet(page)))
  await page.reload({ waitUntil: 'networkidle0' })
  await wait(2000)
  step(`iPhone Safari: not shown again after "Not now" (snoozed 14 days): ${!(await sheet(page))}`, !(await sheet(page)))
  const labels = await userMenuLabels(page)
  step(`iPhone Safari: user menu offers "Add to Home Screen" (${labels.join(', ')})`, labels.includes('Add to Home Screen'))
  const items = await page.$$('[role="menuitem"]')
  await items[labels.indexOf('Add to Home Screen')].tap()
  await page.waitForSelector('section[aria-label="Add Folio to your Home Screen"]')
  await wait(300)
  const onTop = await page.evaluate(() => !!document.elementFromPoint(195, 780)?.closest('section[aria-label]'))
  step(`iPhone Safari: the menu item reopens the guide, on top, drawer closed: ${onTop}`, onTop && !(await page.evaluate(() => getComputedStyle(document.querySelector('aside:not([aria-label])')).display !== 'none')))
  await page.keyboard.press('Escape')
  await wait(300)
  step(`iPhone Safari: Escape closes the guide: ${!(await sheet(page))}`, !(await sheet(page)))
  await page.browserContext().close()
}

// ---- other iOS browsers
{
  const page = await open({ ua: UA.chrome })
  const text = await sheetText(page)
  step(`iPhone Chrome: step 1 points to the address bar: ${/address bar/.test(text || '')}`, /address bar/.test(text || ''))
  await page.browserContext().close()
}
{
  const page = await open({ ua: UA.instagram })
  const text = await sheetText(page)
  step(`Instagram's in-app browser: says to open Safari and offers Copy link: ${/Open Folio in Safari/.test(text || '') && /Copy link/.test(text || '')}`, /Open Folio in Safari/.test(text || '') && /Copy link/.test(text || ''))
  await page.screenshot({ path: `${out}/install-ios-inapp.png` })
  await page.browserContext().close()
}

// ---- already on the Home Screen: never nag
{
  const page = await open({ ua: UA.safari, standalone: true })
  step(`launched from the Home Screen: no guide: ${!(await sheet(page))}`, !(await sheet(page)))
  const labels = await userMenuLabels(page)
  step(`launched from the Home Screen: no "Add to Home Screen" item (${labels.join(', ')})`, !labels.includes('Add to Home Screen'))
  await page.browserContext().close()
}

// ---- Android Chrome: a real Install button (the browser's own install prompt)
{
  const page = await open({
    ua: UA.android,
    before: () => {
      // stand-in for Chrome's beforeinstallprompt, which headless Chrome doesn't fire
      window.addEventListener('load', () =>
        setTimeout(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true })
          e.prompt = () => (window.__prompted = true)
          e.userChoice = Promise.resolve({ outcome: 'accepted' })
          window.dispatchEvent(e)
        }, 500),
      )
    },
  })
  const text = await sheetText(page)
  step(`Android: guide offers "Install Folio" (no iOS steps): ${/Install Folio/.test(text || '') && !/Safari/.test(text || '')}`, /Install Folio/.test(text || '') && !/Safari/.test(text || ''))
  await page.screenshot({ path: `${out}/install-android.png` })
  const [btn] = await page.$$('xpath/.//section[@aria-label="Add Folio to your Home Screen"]//button[normalize-space()="Install Folio"]')
  await btn.tap()
  await wait(400)
  const prompted = await page.evaluate(() => window.__prompted === true)
  step(`Android: Install opens the browser's install prompt, guide closes after accepting: ${prompted && !(await sheet(page))}`, prompted && !(await sheet(page)))
  await page.browserContext().close()
}

console.log('console errors:', errors.length ? errors : 'none')
if (errors.length) process.exitCode = 1
await browser.close()
