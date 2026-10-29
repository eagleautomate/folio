// Server datetimes carry no timezone. `clock.offset` (set at boot from the
// server's own "now") maps them onto the browser clock.
export const clock = { offset: 0 }

export function parseServerDate(value) {
  return new Date(String(value).replace(' ', 'T'))
}

export function syncServerClock(serverNow) {
  if (serverNow) clock.offset = Date.now() - parseServerDate(serverNow).getTime()
}

export function timeAgo(value) {
  if (!value) return ''
  const seconds = Math.round((Date.now() - clock.offset - parseServerDate(value).getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    const n = Math.floor(seconds / size)
    if (n >= 1) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-n, unit)
  }
  return 'just now'
}

export function pageTitle(page) {
  return page?.title?.trim() || 'Untitled'
}

export function debounce(fn, wait) {
  let timer
  const debounced = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
  debounced.flush = (...args) => {
    clearTimeout(timer)
    return fn(...args)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced
}

export const COVERS = [
  'linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)',
  'linear-gradient(135deg, #a5f3fc 0%, #818cf8 100%)',
  'linear-gradient(135deg, #bbf7d0 0%, #22d3ee 100%)',
  'linear-gradient(135deg, #fbcfe8 0%, #c4b5fd 100%)',
  'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)',
  'linear-gradient(135deg, #fed7aa 0%, #f97316 100%)',
  'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
  'linear-gradient(135deg, #d9f99d 0%, #65a30d 100%)',
]

export const EMOJIS = (
  '📄 📝 📌 📎 📁 📂 🗂️ 📚 📖 📊 📈 📉 🗓️ ⏰ ✅ ☑️ 🎯 🚀 💡 🔥 ⭐ 🌟 ✨ 🎉 ' +
  '🏗️ 🏢 🏠 🏭 🛠️ 🔧 ⚙️ 🧰 🔒 🔑 🧭 🗺️ 🌍 💼 💰 💳 🧾 📦 🚚 ✈️ 🛒 🤝 ' +
  '👋 👥 🧑‍💻 🧠 💬 📣 📞 ✉️ 🔔 ❤️ 💚 💙 💜 🧡 💛 🟢 🟡 🔴 🔵 🟣 ⚪ ⚫ 🧪 ' +
  '🐞 🧩 🎨 🖌️ 📷 🎬 🎵 ☕ 🍕 🌱 🌳 🌊 ☀️ 🌙 ⚡ 🏆 🥇 📍 🧱 🗒️ 📋 🔍 🧷'
).split(' ')
