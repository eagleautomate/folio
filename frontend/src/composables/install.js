import { reactive } from 'vue'

// "Add Folio to your Home Screen". iOS has no install prompt: people add the site from
// the Share menu, so Folio shows them how. Android (Chrome) fires `beforeinstallprompt`,
// and the same sheet offers a real Install button instead.
const KEY = 'folio:install-dismissed'
const SNOOZE_DAYS = 14
const ua = navigator.userAgent

export const device = {
  // iPadOS reports itself as a Mac; a touch screen gives it away
  ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
  // browsers inside other apps (Instagram, Gmail, Facebook…) can't add to the Home Screen
  inApp: /FBAN|FBAV|Instagram|LinkedInApp|Line\/|GSA\/|Twitter|Snapchat/.test(ua),
  browser: /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : 'safari',
}

export const install = reactive({
  open: false,
  // Android/desktop Chrome: the deferred install prompt, if the browser offered one
  prompt: null,
})

export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

// Whether "Add to Home Screen" can be offered at all (also drives the user-menu entry)
export function canInstall() {
  return !isStandalone() && (device.ios || !!install.prompt)
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  install.prompt = e
  maybeShow()
})
window.addEventListener('appinstalled', () => {
  install.prompt = null
  install.open = false
})

// Shown once on a phone or tablet, then not again for two weeks after "Not now".
export function maybeShow() {
  if (!canInstall() || snoozed() || !window.matchMedia('(hover: none)').matches) return
  install.open = true
}

export function dismiss() {
  install.open = false
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // convenience only
  }
}

export async function promptInstall() {
  const event = install.prompt
  if (!event) return
  event.prompt()
  const { outcome } = await event.userChoice
  install.prompt = null
  if (outcome === 'accepted') install.open = false
}

function snoozed() {
  try {
    const at = Number(localStorage.getItem(KEY) || 0)
    return Date.now() - at < SNOOZE_DAYS * 864e5
  } catch {
    return false
  }
}
