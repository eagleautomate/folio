<template>
  <NodeViewWrapper class="folio-project" :class="{ 'is-selected': selected }" data-type="erpnext-project">
    <div class="rounded-lg border border-outline-gray-2 bg-surface-base" contenteditable="false">
      <!-- choose a project (block inserted with /project) -->
      <div v-if="!node.attrs.project" class="relative p-3">
        <input
          ref="picker"
          v-model="query"
          class="h-8 w-full rounded border-0 bg-surface-gray-2 px-2 text-base focus:ring-0"
          placeholder="Search ERPNext projects…"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="pick(found[highlight])"
          @keydown.esc.prevent="deleteNode()"
        />
        <div class="mt-1 max-h-56 overflow-y-auto" @mousedown.prevent>
          <button
            v-for="(p, i) in found"
            :key="p.name"
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-base"
            :class="i === highlight ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
            @mouseenter="highlight = i"
            @click="pick(p)"
          >
            <span class="flex-1 truncate text-ink-gray-8">{{ p.project_name }}</span>
            <span class="text-xs text-ink-gray-5">{{ p.name }} · {{ p.status }}</span>
          </button>
          <p v-if="!found.length" class="px-2 py-1.5 text-sm text-ink-gray-5">No projects found</p>
        </div>
      </div>

      <div v-else-if="!data" class="flex items-center gap-2 p-4 text-base text-ink-gray-5">
        <LoadingIndicator class="size-4" /> Loading project…
      </div>

      <div v-else-if="data.restricted || data.missing" class="flex items-center gap-2 p-4 text-base text-ink-gray-5">
        <LucideLock v-if="data.restricted" class="size-4" />
        <LucideCircleAlert v-else class="size-4" />
        {{ data.restricted ? "A project you don't have access to" : `Project ${node.attrs.project} was deleted in ERPNext` }}
      </div>

      <template v-else>
        <!-- summary -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-outline-gray-1 px-4 py-3">
          <a
            :href="`/desk/project/${data.name}`"
            target="_blank"
            class="flex min-w-0 items-center gap-2 text-lg font-semibold text-ink-gray-9 hover:underline"
            :title="`Open ${data.name} in ERPNext`"
          >
            <LucideFolderKanban class="size-5 shrink-0 text-ink-gray-5" />
            <span class="truncate">{{ data.project_name }}</span>
          </a>
          <Badge :theme="statusTheme" :label="data.status" />
          <div class="ml-auto flex items-center gap-4 text-sm text-ink-gray-6">
            <span v-if="dates" class="flex items-center gap-1"><LucideCalendar class="size-3.5" /> {{ dates }}</span>
            <span class="flex items-center gap-2" :title="`${Math.round(data.percent_complete || 0)}% complete`">
              <span class="h-1.5 w-20 overflow-hidden rounded-full bg-surface-gray-3">
                <span class="block h-full rounded-full bg-surface-gray-7" :style="{ width: `${Math.min(100, data.percent_complete || 0)}%` }" />
              </span>
              {{ Math.round(data.percent_complete || 0) }}%
            </span>
          </div>
        </div>

        <!-- tasks -->
        <div class="px-4 py-2">
          <div class="mb-1 flex items-center gap-3 text-xs text-ink-gray-5">
            <span class="font-medium text-ink-gray-6">Tasks</span>
            <span>{{ data.counts.open }} open</span>
            <span>{{ data.counts.completed }} done</span>
            <span v-if="data.counts.overdue" class="text-ink-red-4">{{ data.counts.overdue }} overdue</span>
            <button class="ml-auto hover:text-ink-gray-8" title="Refresh" aria-label="Refresh tasks" @click="load">
              <LucideRefreshCw class="size-3.5" :class="{ 'animate-spin': loading }" />
            </button>
          </div>

          <p v-if="!data.tasks.length" class="py-2 text-base text-ink-gray-5">No tasks yet.</p>
          <TaskRow
            v-for="t in visibleTasks"
            :key="t.name"
            :task="t"
            :show-project="false"
            compact
            @updated="onTaskUpdated"
          />
          <button
            v-if="completedCount && !showCompleted"
            class="mt-1 text-sm text-ink-gray-5 hover:text-ink-gray-8"
            @click="showCompleted = true"
          >
            Show {{ completedCount }} completed
          </button>

          <form v-if="canAdd" class="mt-1 flex items-center gap-2.5 py-1" @submit.prevent="addTask">
            <LucidePlus class="size-[18px] shrink-0 text-ink-gray-4" />
            <input
              v-model="newTask"
              class="h-7 flex-1 border-0 bg-transparent p-0 text-base placeholder-ink-gray-4 focus:ring-0"
              placeholder="Add a task to this project…"
              :disabled="adding"
            />
          </form>
        </div>
      </template>
    </div>
  </NodeViewWrapper>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Badge, LoadingIndicator, call, toast } from 'frappe-ui'
import TaskRow from './TaskRow.vue'
import { debounce } from '@/utils'

const props = defineProps(nodeViewProps)

const data = ref(null)
const loading = ref(false)
const showCompleted = ref(false)
const newTask = ref('')
const adding = ref(false)
const query = ref('')
const found = ref([])
const highlight = ref(0)
const picker = ref(null)

const pageName = computed(() => props.extension.options.context?.pageName)
const canAdd = computed(() => props.editor.isEditable && data.value?.can_create_task)
const isDone = (t) => ['Completed', 'Cancelled'].includes(t.status)
const completedCount = computed(() => data.value?.tasks.filter(isDone).length || 0)
const visibleTasks = computed(() => (data.value?.tasks || []).filter((t) => showCompleted.value || !isDone(t)))
const statusTheme = computed(
  () => ({ Open: 'blue', 'On hold': 'orange', Completed: 'green', Cancelled: 'gray' })[data.value?.status] || 'gray',
)
const dates = computed(() => {
  const fmt = (v) => new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const { expected_start_date: s, expected_end_date: e } = data.value || {}
  if (s && e) return `${fmt(s)} – ${fmt(e)}`
  return e ? `Due ${fmt(e)}` : s ? `From ${fmt(s)}` : ''
})

async function load() {
  if (!props.node.attrs.project) return
  loading.value = true
  try {
    data.value = await call('folio.api.projects.get_project', { name: props.node.attrs.project })
  } catch {
    data.value = data.value || { name: props.node.attrs.project, restricted: true }
  } finally {
    loading.value = false
  }
}

function onTaskUpdated(updated) {
  const i = data.value.tasks.findIndex((t) => t.name === updated.name)
  if (i >= 0) data.value.tasks[i] = updated
  load() // counts and % complete are computed by ERPNext
}

async function addTask() {
  const subject = newTask.value.trim()
  if (!subject) return
  adding.value = true
  try {
    await call('folio.api.tasks.create_task', { page: pageName.value, subject, project: props.node.attrs.project })
    newTask.value = ''
    await load()
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not create the task')
  } finally {
    adding.value = false
  }
}

// ---- picker for an empty block
const searchProjects = debounce(async (q) => {
  found.value = await call('folio.api.projects.search_projects', { query: q }).catch(() => [])
  highlight.value = 0
}, 200)
watch(query, searchProjects)

function move(step) {
  const n = found.value.length
  if (n) highlight.value = (highlight.value + step + n) % n
}

function pick(p) {
  if (p) props.updateAttributes({ project: p.name })
}

watch(() => props.node.attrs.project, load)

function onVisible() {
  if (document.visibilityState === 'visible') load()
}
onMounted(() => {
  if (props.node.attrs.project) load()
  else if (props.editor.isEditable) {
    searchProjects('')
    requestAnimationFrame(() => requestAnimationFrame(() => picker.value?.focus()))
  }
  window.addEventListener('focus', load)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', load)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>
