// Renders the home-screen icons from folio/public/images/folio-icon.svg (full-bleed square:
// iOS rounds the corners itself and fills transparency with black; the glyph sits inside
// the maskable safe zone, so Android can crop it to any shape).
//   node scripts/pwa-icons.mjs
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const svg = fs.readFileSync('../folio/public/images/folio-icon.svg', 'utf8')
const out = '../folio/public/images/pwa'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const page = await browser.newPage()
for (const [name, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) {
  await page.setViewport({ width: size, height: size })
  await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block">`)
  await page.screenshot({ path: `${out}/${name}.png`, clip: { x: 0, y: 0, width: size, height: size } })
  console.log(`${name}.png ${size}x${size}`)
}
await browser.close()
