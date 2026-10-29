<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-[1400px] px-6 pb-16 pt-10 sm:px-12">
      <div class="flex flex-wrap items-end gap-3">
        <div class="mr-auto">
          <h1 class="flex items-center gap-2 text-3xl font-bold text-ink-gray-9">📁 Projects</h1>
          <p class="mt-1 text-base text-ink-gray-5">Every ERPNext project, with its page, progress and tasks.</p>
        </div>
        <Button v-if="canCreate" variant="solid" icon-left="lucide-plus" label="New project" @click="newOpen = true" />
      </div>

      <!-- toolbar -->
      <div class="mt-6 flex flex-wrap items-center gap-2">
        <div class="flex rounded-md bg-surface-gray-2 p-0.5" role="radiogroup" aria-label="View">
          <button
            v-for="v in VIEWS"
            :key="v.id"
            role="radio"
            :aria-checked="view === v.id"
            class="flex h-6 items-center gap-1.5 rounded px-2 text-sm"
            :class="view === v.id ? 'bg-surface-base font-medium text-ink-gray-9 shadow-sm' : 'text-ink-gray-6 hover:text-ink-gray-8'"
            @click="setQuery({ view: v.id === 'table' ? undefined : v.id })"
          >
            <component :is="v.icon" class="size-3.5" /> {{ v.label }}
          </button>
        </div>
        <select
          :value="scope"
          class="folio-select !w-auto"
          aria-label="Show"
          @change="setQuery({ scope: $event.target.value === 'active' ? undefined : $event.target.value })"
        >
          <option value="active">Active projects</option>
          <option value="completed">Completed &amp; cancelled</option>
          <option value="all">All projects</option>
        </select>
        <div class="relative">
          <LucideSearch class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-gray-4" />
          <input v-model="query" class="h-7 w-52 rounded border-0 bg-surface-gray-2 pl-7 pr-2 text-sm placeholder-ink-gray-4 focus:ring-0" placeholder="Search projects" />
        </div>
        <Button size="sm" :variant="mine ? 'subtle' : 'ghost'" icon-left="lucide-user" label="My projects" @click="setQuery({ mine: mine ? undefined : '1' })" />
        <span class="ml-auto text-xs text-ink-gray-5">{{ projects.length }} project{{ projects.length === 1 ? '' : 's' }}</span>
      </div>

      <div v-if="loading && !loaded" class="mt-6 flex items-center gap-2 text-base text-ink-gray-5"><LoadingIndicator class="size-4" /> Loading projects…</div>
      <div v-else-if="error" class="mt-6 text-base text-ink-gray-6">{{ error }}</div>
      <div v-else-if="!projects.length" class="mt-6 rounded-lg border border-dashed border-outline-gray-2 p-10 text-center text-base text-ink-gray-5">
        {{ query || mine ? 'No projects match.' : scope === 'active' ? 'No active projects.' : 'No projects.' }}
      </div>

      <!-- table -->
      <div v-else-if="view === 'table'" class="mt-4 overflow-x-auto rounded-lg border border-outline-gray-1">
        <table class="w-full min-w-[900px] table-fixed text-left text-sm">
          <colgroup>
            <col />
            <col class="w-28" />
            <col class="w-40" />
            <col class="w-40" />
            <col class="w-24" />
            <col class="w-24" />
            <col class="w-36" />
          </colgroup>
          <thead class="bg-surface-gray-1 text-xs text-ink-gray-5">
            <tr>
              <th v-for="c in COLUMNS" :key="c.key" class="px-3 py-2 font-medium">
                <button class="flex items-center gap-1 hover:text-ink-gray-8" @click="sortBy(c.key)">
                  {{ c.label }}
                  <LucideArrowUp v-if="sort.key === c.key && sort.asc" class="size-3" />
                  <LucideArrowDown v-else-if="sort.key === c.key" class="size-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-gray-1">
            <tr v-for="p in sorted" :key="p.name" class="cursor-pointer hover:bg-surface-gray-1" @click="open(p)">
              <td class="px-3 py-2">
                <div class="truncate text-base font-medium text-ink-gray-8">{{ p.project_name }}</div>
                <div class="truncate text-xs text-ink-gray-5">{{ p.name }}<template v-if="p.customer"> · {{ p.customer }}</template></div>
              </td>
              <td class="px-3 py-2"><Badge size="sm" :theme="statusTheme(p.status)" :label="p.status" /></td>
              <td class="px-3 py-2">
                <span class="flex items-center gap-2">
                  <span class="h-1.5 w-20 overflow-hidden rounded-full bg-surface-gray-3">
                    <span class="block h-full rounded-full bg-surface-gray-7" :style="{ width: `${pct(p)}%` }" />
                  </span>
                  {{ pct(p) }}%
                </span>
              </td>
              <td class="whitespace-nowrap px-3 py-2" :class="{ 'font-medium text-ink-red-6': isLate(p) }">{{ dates(p) || '—' }}</td>
              <td class="px-3 py-2">{{ p.counts.open }}</td>
              <td class="px-3 py-2" :class="p.counts.overdue ? 'font-medium text-ink-red-6' : 'text-ink-gray-4'">{{ p.counts.overdue || '—' }}</td>
              <td class="px-3 py-2">
                <div v-if="p.team.length" class="flex -space-x-1.5">
                  <Avatar v-for="m in p.team.slice(0, 5)" :key="m.user" size="sm" :label="m.full_name" :image="m.image" :title="m.full_name" class="ring-2 ring-outline-base" />
                </div>
                <span v-else class="text-ink-gray-4">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- board by project status -->
      <div v-else class="mt-4 flex gap-3 overflow-x-auto pb-4">
        <section
          v-for="col in boardColumns"
          :key="col.status"
          :data-column="col.status"
          :aria-label="col.status"
          class="flex w-72 shrink-0 flex-col rounded-lg bg-surface-gray-1"
          :class="{ 'bg-surface-gray-2 ring-2 ring-outline-gray-3': over === col.status }"
          @dragover.prevent="onDragOver($event, col.status)"
          @dragleave="(e) => !e.currentTarget.contains(e.relatedTarget) && (over = null)"
          @drop.prevent="onDrop($event, col.status)"
        >
          <header class="flex items-center gap-2 px-3 pb-1 pt-2.5 text-sm">
            <Badge size="sm" :theme="statusTheme(col.status)" :label="col.status" />
            <span class="text-ink-gray-5">{{ col.projects.length }}</span>
          </header>
          <div class="flex min-h-24 flex-col gap-2 p-2">
            <div
              v-for="p in col.projects"
              :key="p.name"
              class="cursor-pointer rounded-md border border-outline-gray-2 bg-surface-base p-3 shadow-sm hover:shadow-md"
              :draggable="p.can_edit"
              @dragstart="(e) => e.dataTransfer.setData('text/x-folio-project', p.name)"
              @click="open(p)"
            >
              <div class="text-base font-medium text-ink-gray-8">{{ p.project_name }}</div>
              <div class="mt-2 flex items-center gap-2 text-xs text-ink-gray-5">
                <span class="h-1.5 w-16 overflow-hidden rounded-full bg-surface-gray-3">
                  <span class="block h-full rounded-full bg-surface-gray-7" :style="{ width: `${pct(p)}%` }" />
                </span>
                {{ pct(p) }}%
                <span v-if="p.expected_end_date" :class="{ 'font-medium text-ink-red-6': isLate(p) }">· {{ formatDateRange(null, p.expected_end_date).replace('Due ', '') }}</span>
              </div>
              <div class="mt-2 flex items-center gap-2 text-xs text-ink-gray-5">
                <span>{{ p.counts.open }} open</span>
                <span v-if="p.counts.overdue" class="text-ink-red-6">{{ p.counts.overdue }} overdue</span>
                <div v-if="p.team.length" class="ml-auto flex -space-x-1.5">
                  <Avatar v-for="m in p.team.slice(0, 4)" :key="m.user" size="sm" :label="m.full_name" :image="m.image" class="ring-2 ring-outline-base" />
                </div>
              </div>
            </div>
            <p v-if="!col.projects.length" class="px-1 py-2 text-sm text-ink-gray-4">No projects</p>
          </div>
        </section>
      </div>
    </div>

    <NewProjectDialog v-model="newOpen" @created="onCreated" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Avatar, Badge, Button, LoadingIndicator, call, toast } from 'frappe-ui'
import NewProjectDialog from '@/components/project/NewProjectDialog.vue'
import { loadWorkspace } from '@/data/workspace'
import { debounce, formatDateRange } from '@/utils'
import IconTable from '~icons/lucide/table-2'
import IconBoard from '~icons/lucide/square-kanban'

const VIEWS = [
  { id: 'table', label: 'Table', icon: IconTable },
  { id: 'board', label: 'Board', icon: IconBoard },
]
const COLUMNS = [
  { key: 'project_name', label: 'Project' },
  { key: 'status', label: 'Status' },
  { key: 'percent_complete', label: 'Progress' },
  { key: 'expected_end_date', label: 'Dates' },
  { key: 'open', label: 'Open tasks' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'team', label: 'Team' },
]
const STATUS_ORDER = ['Open', 'On hold', 'Completed', 'Cancelled']

const route = useRoute()
const router = useRouter()
document.title = 'Projects · Folio'

const projects = ref([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const query = ref('')
const canCreate = ref(false)
const newOpen = ref(false)
const over = ref(null)
const sort = reactive({ key: 'expected_end_date', asc: true })

// view and filters live in the URL so they survive reloads and can be shared
const view = computed(() => (route.query.view === 'board' ? 'board' : 'table'))
const scope = computed(() => (['completed', 'all'].includes(route.query.scope) ? route.query.scope : 'active'))
const mine = computed(() => route.query.mine === '1')

async function load() {
  loading.value = true
  try {
    projects.value = await call('folio.api.projects.list_projects', { scope: scope.value, mine: mine.value ? 1 : 0, query: query.value || null })
    error.value = ''
  } catch (e) {
    error.value = e?.messages?.[0] || 'Could not load projects'
  } finally {
    loading.value = false
    loaded.value = true
  }
}
const reloadSoon = debounce(load, 250)
watch([scope, mine], load)
watch(query, reloadSoon)

function setQuery(patch) {
  router.replace({ query: { ...route.query, ...patch } })
}

const pct = (p) => Math.round(Math.min(100, p.percent_complete || 0))
const dates = (p) => formatDateRange(p.expected_start_date, p.expected_end_date)
const isLate = (p) => ['Open', 'On hold'].includes(p.status) && p.expected_end_date && new Date(`${p.expected_end_date}T23:59:59`) < new Date()
const statusTheme = (s) => ({ Open: 'blue', 'On hold': 'orange', Completed: 'green', Cancelled: 'gray' })[s] || 'gray'

const rank = {
  project_name: (p) => p.project_name.toLowerCase(),
  status: (p) => STATUS_ORDER.indexOf(p.status),
  percent_complete: (p) => p.percent_complete || 0,
  expected_end_date: (p) => p.expected_end_date || '9999',
  open: (p) => p.counts.open,
  overdue: (p) => p.counts.overdue,
  team: (p) => p.team.length,
}
function sortBy(key) {
  if (sort.key === key) sort.asc = !sort.asc
  else Object.assign(sort, { key, asc: key !== 'overdue' && key !== 'open' })
}
const sorted = computed(() => {
  const key = rank[sort.key]
  return [...projects.value].sort((a, b) => {
    const x = key(a)
    const y = key(b)
    return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1)
  })
})

const boardColumns = computed(() => {
  const statuses = scope.value === 'active' ? ['Open', 'On hold'] : scope.value === 'completed' ? ['Completed', 'Cancelled'] : STATUS_ORDER
  return statuses.map((status) => ({ status, projects: sorted.value.filter((p) => p.status === status) }))
})

function open(p) {
  if (p.page) router.push({ name: 'Page', params: { name: p.page } })
  else toast.warning('This project has no Folio page yet', { description: 'A manager can create it from Folio Settings.' })
}

function onDragOver(e, status) {
  if (e.dataTransfer.types.includes('text/x-folio-project')) over.value = status
}

async function onDrop(e, status) {
  over.value = null
  const name = e.dataTransfer.getData('text/x-folio-project')
  const project = projects.value.find((p) => p.name === name)
  if (!project || project.status === status) return
  try {
    await call('folio.api.projects.set_status', { name, status })
    project.status = status
  } catch (err) {
    toast.error(err?.messages?.[0] || 'Could not change the status')
  }
  load()
}

async function onCreated({ page }) {
  await loadWorkspace()
  router.push({ name: 'Page', params: { name: page }, query: { tab: 'tasks' } })
}

function onVisible() {
  if (document.visibilityState === 'visible') load()
}
onMounted(async () => {
  load()
  canCreate.value = await call('folio.api.projects.can_create_project').catch(() => false)
  window.addEventListener('focus', load)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', load)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>
