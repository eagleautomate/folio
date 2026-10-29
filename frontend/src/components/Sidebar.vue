<template>
  <aside class="flex h-full w-60 shrink-0 flex-col border-r border-outline-gray-1 bg-surface-gray-1">
    <!-- workspace / user -->
    <div class="p-2">
      <Dropdown :options="userMenu" align="start">
        <template #trigger>
          <button class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-gray-3">
            <img :src="logoUrl" class="size-6 rounded" alt="" />
            <div class="min-w-0 flex-1 leading-tight">
              <div class="truncate text-base font-semibold text-ink-gray-9">Folio</div>
              <div class="truncate text-xs text-ink-gray-5">{{ state.boot?.full_name }}</div>
            </div>
            <LucideChevronsUpDown class="size-3.5 text-ink-gray-5" />
          </button>
        </template>
      </Dropdown>
    </div>

    <nav class="flex flex-col gap-0.5 px-2">
      <SidebarLink label="Search" @click="search.open = true">
        <template #icon><LucideSearch class="size-4" /></template>
        <template #suffix><span class="text-xs text-ink-gray-4">⌘K</span></template>
      </SidebarLink>
      <SidebarLink label="Home" :active="$route.name === 'Home'" @click="$router.push({ name: 'Home' })">
        <template #icon><LucideHome class="size-4" /></template>
      </SidebarLink>
      <SidebarLink label="Trash" @click="trashOpen = true">
        <template #icon><LucideTrash2 class="size-4" /></template>
      </SidebarLink>
    </nav>

    <div class="mt-3 flex-1 overflow-y-auto px-2 pb-4">
      <section v-if="favoritePages.length" class="mb-3">
        <div class="px-2 pb-1 text-xs font-medium text-ink-gray-5">Favorites</div>
        <div
          v-for="page in favoritePages"
          :key="page.name"
          class="flex h-7 cursor-pointer items-center gap-2 rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-2"
          :class="{ '!bg-surface-gray-3 font-medium text-ink-gray-9': $route.params.name === page.name }"
          @click="$router.push({ name: 'Page', params: { name: page.name } })"
        >
          <span v-if="page.icon" class="w-4 text-sm leading-none">{{ page.icon }}</span>
          <LucideFileText v-else class="size-4 text-ink-gray-5" />
          <span class="truncate">{{ pageTitle(page) }}</span>
        </div>
      </section>

      <section v-for="space in state.spaces" :key="space.name" class="mb-3">
        <div
          class="group flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-ink-gray-5 hover:bg-surface-gray-2"
          :class="{ 'ring-1 ring-inset ring-outline-gray-4': dropOnSpace === space.name }"
          @dragover.prevent="onSpaceDragOver(space)"
          @dragleave="dropOnSpace = null"
          @drop.prevent="onSpaceDrop(space)"
        >
          <button class="flex min-w-0 flex-1 items-center gap-1.5" @click="toggleSpace(space.name)">
            <span v-if="space.icon" class="text-sm leading-none">{{ space.icon }}</span>
            <span class="truncate">{{ space.title }}</span>
            <LucideLock v-if="space.visibility === 'Private'" class="size-3 shrink-0" />
            <LucideChevronDown
              class="size-3 shrink-0 opacity-0 transition-transform group-hover:opacity-100"
              :class="{ '-rotate-90': collapsed[space.name] }"
            />
          </button>
          <Dropdown :options="spaceMenu(space)" align="start">
            <template #trigger>
              <button
                class="hidden size-5 items-center justify-center rounded hover:bg-surface-gray-4 group-hover:flex"
                :aria-label="`${space.title} options`"
              >
                <LucideMoreHorizontal class="size-3.5" />
              </button>
            </template>
          </Dropdown>
          <button
            v-if="canEditSpace(space.name)"
            class="hidden size-5 items-center justify-center rounded hover:bg-surface-gray-4 group-hover:flex"
            aria-label="New page in this space"
            @click="newPage(space.name)"
          >
            <LucidePlus class="size-3.5" />
          </button>
        </div>
        <template v-if="!collapsed[space.name]">
          <!-- the projects space opens with its overview of all projects -->
          <div
            v-if="space.name === state.boot?.projects_space && state.boot?.can_read_projects"
            class="flex h-7 cursor-pointer items-center gap-2 rounded px-1 text-base text-ink-gray-7 hover:bg-surface-gray-2"
            :class="{ '!bg-surface-gray-3 font-medium text-ink-gray-9': $route.name === 'Projects' }"
            style="padding-left: 4px"
            @click="$router.push({ name: 'Projects' })"
          >
            <span class="flex size-5 items-center justify-center"><LucideLayoutGrid class="size-4 text-ink-gray-5" /></span>
            All projects
          </div>
          <PageTreeItem v-for="page in visiblePages(space.name)" :key="page.name" :page="page" />
          <button
            v-if="finishedCount(space.name)"
            class="flex h-7 w-full items-center gap-2 rounded px-1 text-left text-sm text-ink-gray-5 hover:bg-surface-gray-2"
            @click="$router.push({ name: 'Projects', query: { scope: 'completed' } })"
          >
            <span class="flex size-5 items-center justify-center"><LucideArchive class="size-3.5" /></span>
            {{ finishedCount(space.name) }} completed
          </button>
          <button
            v-if="!childrenOf(space.name).length && canEditSpace(space.name)"
            class="flex h-7 w-full items-center gap-2 rounded px-2 text-base text-ink-gray-5 hover:bg-surface-gray-2"
            @click="newPage(space.name)"
          >
            <LucidePlus class="size-4" /> Add a page
          </button>
        </template>
      </section>
    </div>

    <div class="border-t border-outline-gray-1 p-2">
      <SidebarLink label="New space" @click="spaceOpen = true">
        <template #icon><LucidePlusSquare class="size-4" /></template>
      </SidebarLink>
    </div>

    <TrashDialog v-model="trashOpen" />
    <NewSpaceDialog v-model="spaceOpen" />
    <SpaceSettingsDialog v-model="settings.open" :space-name="settings.space" :initial-tab="settings.tab" />
  </aside>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dropdown, toast } from 'frappe-ui'
import SidebarLink from '@/components/SidebarLink.vue'
import PageTreeItem from '@/components/PageTreeItem.vue'
import TrashDialog from '@/components/TrashDialog.vue'
import NewSpaceDialog from '@/components/NewSpaceDialog.vue'
import SpaceSettingsDialog from '@/components/SpaceSettingsDialog.vue'
import { state, childrenOf, createPage, movePage, canEditSpace, pagesByName } from '@/data/workspace'
import { drag, resetDrag } from '@/composables/dragTree'
import { search } from '@/composables/search'
import { pageTitle } from '@/utils'

const router = useRouter()
const route = useRoute()
const logoUrl = '/assets/folio/images/folio-logo.svg'
const trashOpen = ref(false)
const spaceOpen = ref(false)
const dropOnSpace = ref(null)
const collapsed = reactive(loadCollapsed())
const settings = reactive({ open: false, space: null, tab: 'General' })

function openSettings(space, tab = 'General') {
  Object.assign(settings, { open: true, space: space.name, tab })
}

function spaceMenu(space) {
  const manage = space.access === 'full'
  return [
    { label: manage ? 'Space settings' : 'About this space', icon: 'lucide-settings', onClick: () => openSettings(space) },
    { label: manage ? 'Manage members' : 'Members', icon: 'lucide-users', onClick: () => openSettings(space, 'Members') },
    canEditSpace(space.name) && { label: 'New page', icon: 'lucide-plus', onClick: () => newPage(space.name) },
  ].filter(Boolean)
}

// Finished projects (Completed / Cancelled) stay out of the sidebar; "All projects" has them.
// The page you're on is always shown, so the sidebar never loses your place.
const FINISHED = ['Completed', 'Cancelled']
const isFinished = (page) => page.is_project_page && FINISHED.includes(page.project_status)
function visiblePages(space) {
  return childrenOf(space).filter((p) => !isFinished(p) || route.params.name === p.name)
}
function finishedCount(space) {
  return childrenOf(space).filter((p) => isFinished(p) && route.params.name !== p.name).length
}

const favoritePages = computed(() => state.favorites.map((name) => pagesByName.value[name]).filter(Boolean))

const userMenu = [
  { label: 'Open Desk', icon: 'lucide-layout-grid', onClick: () => (window.location.href = '/desk') },
  { label: 'Apps', icon: 'lucide-grid-2x2', onClick: () => (window.location.href = '/apps') },
  {
    label: 'Log out',
    icon: 'lucide-log-out',
    onClick: async () => {
      await fetch('/api/method/logout', { method: 'POST', headers: { 'X-Frappe-CSRF-Token': window.csrf_token } })
      window.location.href = '/login'
    },
  },
]

function loadCollapsed() {
  try {
    return JSON.parse(localStorage.getItem('folio:collapsed-spaces') || '{}')
  } catch {
    return {}
  }
}

function toggleSpace(name) {
  collapsed[name] = !collapsed[name]
  try {
    localStorage.setItem('folio:collapsed-spaces', JSON.stringify(collapsed))
  } catch {
    // convenience only
  }
}

async function newPage(space) {
  collapsed[space] = false
  const page = await createPage(space)
  router.push({ name: 'Page', params: { name: page.name } })
}

function onSpaceDragOver(space) {
  if (drag.page && canEditSpace(space.name)) dropOnSpace.value = space.name
}

async function onSpaceDrop(space) {
  const dragged = drag.page
  dropOnSpace.value = null
  resetDrag()
  if (!dragged) return
  try {
    await movePage(dragged, space.name, null, childrenOf(space.name).length)
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not move the page')
  }
}
</script>
