import { reactive } from 'vue'

// Sidebar state. On desktop the sidebar is a column that can be collapsed (remembered
// per browser); below the `md` breakpoint it is a drawer over the page, closed by default.
const MOBILE = window.matchMedia('(max-width: 767px)')
const KEY = 'folio:sidebar-collapsed'

export const layout = reactive({
  mobile: MOBILE.matches,
  collapsed: load(),
  drawerOpen: false,
})

MOBILE.addEventListener('change', (e) => {
  layout.mobile = e.matches
  layout.drawerOpen = false
})

export function sidebarVisible() {
  return layout.mobile ? layout.drawerOpen : !layout.collapsed
}

export function toggleSidebar() {
  if (layout.mobile) {
    layout.drawerOpen = !layout.drawerOpen
    return
  }
  layout.collapsed = !layout.collapsed
  try {
    localStorage.setItem(KEY, layout.collapsed ? '1' : '0')
  } catch {
    // convenience only
  }
}

export function closeDrawer() {
  layout.drawerOpen = false
}

function load() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
