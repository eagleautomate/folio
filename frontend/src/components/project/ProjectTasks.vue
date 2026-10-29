<template>
  <div>
    <div v-if="!project" class="flex items-center gap-2 py-6 text-base text-ink-gray-5">
      <LoadingIndicator class="size-4" /> Loading tasks…
    </div>
    <p v-else-if="project.restricted || project.missing" class="py-6 text-base text-ink-gray-5">
      Tasks aren't available for this project.
    </p>

    <template v-else>
      <!-- toolbar -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="flex rounded-md bg-surface-gray-2 p-0.5" role="radiogroup" aria-label="View">
          <button
            v-for="v in VIEWS"
            :key="v.id"
            role="radio"
            :aria-checked="view === v.id"
            class="flex h-6 items-center gap-1.5 rounded px-2 text-sm"
            :class="view === v.id ? 'bg-surface-base font-medium text-ink-gray-9 shadow-sm' : 'text-ink-gray-6 hover:text-ink-gray-8'"
            @click="setQuery({ view: v.id === 'list' ? undefined : v.id })"
          >
            <component :is="v.icon" class="size-3.5" /> {{ v.label }}
          </button>
        </div>
        <select
          v-if="view === 'board'"
          :value="groupBy"
          class="folio-select !w-auto"
          aria-label="Group by"
          @change="setQuery({ group: $event.target.value === 'status' ? undefined : $event.target.value })"
        >
          <option value="status">Group: Status</option>
          <option value="assignee">Group: Assignee</option>
          <option value="priority">Group: Priority</option>
        </select>
        <div class="relative">
          <LucideSearch class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-gray-4" />
          <input
            v-model="query"
            class="h-7 w-44 rounded border-0 bg-surface-gray-2 pl-7 pr-2 text-sm placeholder-ink-gray-4 focus:ring-0"
            placeholder="Filter tasks"
          />
        </div>
        <Button size="sm" :variant="mineOnly ? 'subtle' : 'ghost'" icon-left="lucide-user" label="My tasks" @click="mineOnly = !mineOnly" />
        <Button
          v-if="view !== 'list' && !(view === 'board' && groupBy === 'status')"
          size="sm"
          :variant="showDone ? 'subtle' : 'ghost'"
          icon-left="lucide-check-check"
          label="Completed"
          @click="showDone = !showDone"
        />
        <span class="ml-auto text-xs text-ink-gray-5">
          {{ project.counts.open }} open · {{ project.counts.completed }} done
          <span v-if="project.counts.overdue" class="text-ink-red-6">· {{ project.counts.overdue }} overdue</span>
        </span>
      </div>

      <!-- add -->
      <form v-if="canAdd" class="mb-2 flex items-center gap-2.5 border-b border-outline-gray-1 pb-2" @submit.prevent="addTask">
        <LucidePlus class="size-[18px] shrink-0 text-ink-gray-4" />
        <input
          ref="addInput"
          v-model="newTask"
          class="h-8 flex-1 border-0 bg-transparent p-0 text-base placeholder-ink-gray-4 focus:ring-0"
          placeholder="Add a task to this project… (Enter)"
          :disabled="adding"
        />
      </form>

      <!-- list -->
      <template v-if="view === 'list'">
        <div class="divide-y divide-outline-gray-1">
          <TaskRow v-for="t in openTasks" :key="t.name" class="py-1.5" :task="t" :show-project="false" openable @open="openTask" @updated="changed" />
        </div>
        <p v-if="!openTasks.length" class="py-4 text-base text-ink-gray-5">
          {{ query || mineOnly ? 'No open tasks match.' : 'No open tasks. Add one above.' }}
        </p>
        <button
          v-if="doneTasks.length"
          class="mt-3 flex items-center gap-1 text-sm text-ink-gray-5 hover:text-ink-gray-8"
          @click="showDone = !showDone"
        >
          <LucideChevronRight class="size-3.5 transition-transform" :class="{ 'rotate-90': showDone }" />
          {{ doneTasks.length }} completed
        </button>
        <div v-if="showDone" class="divide-y divide-outline-gray-1">
          <TaskRow v-for="t in doneTasks" :key="t.name" class="py-1.5" :task="t" :show-project="false" openable @open="openTask" @updated="changed" />
        </div>
      </template>

      <!-- Page.vue widens the page for board/table views -->
      <TaskBoard
        v-else-if="view === 'board'"
        :tasks="groupBy === 'status' || showDone ? filtered : openTasks"
        :team="project.team"
        :group-by="groupBy"
        @open="openTask"
        @changed="changed"
      />

      <TaskTable v-else :tasks="showDone ? filtered : openTasks" @open="openTask" @changed="changed" />
    </template>

    <TaskPanel
      :task-name="panelTask"
      :team="project?.team || []"
      :project-end="project?.expected_end_date || null" @close="setQuery({ task: undefined })" @changed="changed" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, LoadingIndicator, call, toast } from 'frappe-ui'
import TaskRow from '@/components/editor/TaskRow.vue'
import TaskBoard from './TaskBoard.vue'
import TaskTable from './TaskTable.vue'
import TaskPanel from './TaskPanel.vue'
import { state } from '@/data/workspace'
import { isDone } from '@/data/tasks'
import IconList from '~icons/lucide/list'
import IconBoard from '~icons/lucide/square-kanban'
import IconTable from '~icons/lucide/table-2'

const VIEWS = [
  { id: 'list', label: 'List', icon: IconList },
  { id: 'board', label: 'Board', icon: IconBoard },
  { id: 'table', label: 'Table', icon: IconTable },
]

const props = defineProps({
  project: { type: Object, default: null },
  pageName: { type: String, required: true },
  editable: { type: Boolean, default: true },
})
const emit = defineEmits(['changed'])

const route = useRoute()
const router = useRouter()

// view, grouping and the open task live in the URL, so they survive reloads and can be shared
const view = computed(() => (['board', 'table'].includes(route.query.view) ? route.query.view : 'list'))
const groupBy = computed(() => (['assignee', 'priority'].includes(route.query.group) ? route.query.group : 'status'))
const panelTask = computed(() => route.query.task || null)

const query = ref('')
const mineOnly = ref(false)
const showDone = ref(false)
const newTask = ref('')
const adding = ref(false)
const addInput = ref(null)

const canAdd = computed(() => props.editable && props.project?.can_create_task)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const me = state.boot?.user
  return (props.project?.tasks || []).filter(
    (t) =>
      (!q || t.subject.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) &&
      (!mineOnly.value || t.assignees.some((a) => a.user === me) || t.completed_by === me),
  )
})
const openTasks = computed(() => filtered.value.filter((t) => !isDone(t)))
const doneTasks = computed(() => filtered.value.filter(isDone))

function setQuery(patch) {
  router.replace({ query: { ...route.query, ...patch } })
}

function openTask(task) {
  setQuery({ task: task.name })
}

function changed() {
  emit('changed')
}

async function addTask() {
  const subject = newTask.value.trim()
  if (!subject) return
  adding.value = true
  try {
    await call('folio.api.tasks.create_task', { page: props.pageName, subject })
    newTask.value = ''
    changed()
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not create the task')
  } finally {
    adding.value = false
    addInput.value?.focus()
  }
}
</script>
