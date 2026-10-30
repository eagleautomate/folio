// Shared client state for the sidebar: spaces, the flat page list and favorites.
// Pages are kept flat (as the API returns them) and the tree is derived, so a
// rename or move only needs to patch one object.
import { reactive, computed } from 'vue'
import { call } from 'frappe-ui'
import { syncServerClock } from '@/utils'

export const state = reactive({
  loaded: false,
  boot: null,
  spaces: [],
  pages: [],
  favorites: [],
  expanded: loadExpanded(),
})

function loadExpanded() {
  try {
    return JSON.parse(localStorage.getItem('folio:expanded') || '{}')
  } catch {
    return {}
  }
}

function saveExpanded() {
  try {
    localStorage.setItem('folio:expanded', JSON.stringify(state.expanded))
  } catch {
    // storage may be unavailable (private mode); expansion is just a convenience
  }
}

export async function loadWorkspace() {
  const [boot, sidebar] = await Promise.all([
    state.boot ? Promise.resolve(state.boot) : call('folio.api.workspace.get_boot'),
    call('folio.api.workspace.get_sidebar'),
  ])
  state.boot = boot
  syncServerClock(boot.server_now)
  state.spaces = sidebar.spaces
  state.pages = sidebar.pages
  state.favorites = sidebar.favorites
  state.loaded = true
}

export const pagesByName = computed(() => {
  const map = {}
  for (const page of state.pages) map[page.name] = page
  return map
})

export function childrenOf(space, parent = null) {
  return state.pages
    .filter((p) => p.space === space && (p.parent_page || null) === parent)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function hasChildren(name) {
  return state.pages.some((p) => p.parent_page === name)
}

export function isExpanded(key) {
  return !!state.expanded[key]
}

export function setExpanded(key, value) {
  if (value) state.expanded[key] = true
  else delete state.expanded[key]
  saveExpanded()
}

export function expandAncestors(name) {
  let page = pagesByName.value[name]
  while (page && page.parent_page) {
    setExpanded(page.parent_page, true)
    page = pagesByName.value[page.parent_page]
  }
}

export function patchPage(name, fields) {
  const page = pagesByName.value[name]
  if (page) Object.assign(page, fields)
}

export async function createPage(space, parentPage = null, fields = {}) {
  const page = await call('folio.api.pages.create_page', {
    space,
    parent_page: parentPage,
    ...fields,
  })
  state.pages.push(page)
  if (parentPage) setExpanded(parentPage, true)
  return page
}

export async function movePage(name, space, parentPage, index) {
  await call('folio.api.pages.move_page', { name, space, parent_page: parentPage, index })
  await loadWorkspace()
}

export async function archivePage(name) {
  await call('folio.api.pages.archive_page', { name })
  await loadWorkspace()
}

// without `space`: a copy right below; with `space`: "Copy to…" another space
export async function duplicatePage(name, space = null) {
  const page = await call('folio.api.pages.duplicate_page', { name, space })
  await loadWorkspace()
  return page
}

export async function toggleFavorite(name) {
  const { is_favorite } = await call('folio.api.pages.toggle_favorite', { name })
  if (is_favorite) state.favorites.push(name)
  else state.favorites = state.favorites.filter((f) => f !== name)
  return is_favorite
}

export function spaceAccess(space) {
  return state.spaces.find((s) => s.name === space)?.access
}

export function canEditSpace(space) {
  const access = spaceAccess(space)
  return access === 'edit' || access === 'full'
}
