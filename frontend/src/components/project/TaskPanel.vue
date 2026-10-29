<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div v-if="taskName" class="fixed inset-0 z-40 bg-black/10" @click="close" />
    </Transition>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-full"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-x-full"
    >
      <aside
        v-if="taskName"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-outline-gray-2 bg-surface-base shadow-2xl"
        role="dialog"
        aria-label="Task details"
        @keydown.esc="close"
      >
        <header class="flex items-center gap-2 border-b border-outline-gray-1 px-4 py-2.5">
          <span class="text-sm text-ink-gray-5">{{ taskName }}</span>
          <a :href="`/desk/task/${taskName}`" target="_blank" class="flex items-center gap-1 text-sm text-ink-gray-5 hover:text-ink-gray-8">
            Open in ERPNext <LucideExternalLink class="size-3.5" />
          </a>
          <span v-if="saving" class="ml-auto text-xs text-ink-gray-4">Saving…</span>
          <Button class="ml-auto" variant="ghost" icon="lucide-x" aria-label="Close" @click="close" />
        </header>

        <div v-if="!task" class="flex flex-1 items-center justify-center"><LoadingIndicator class="size-5 text-ink-gray-5" /></div>

        <div v-else class="flex-1 overflow-y-auto px-5 py-4">
          <textarea
            ref="titleInput"
            v-model="form.subject"
            rows="1"
            class="w-full resize-none border-0 bg-transparent p-0 text-xl font-semibold text-ink-gray-9 focus:ring-0"
            :readonly="!task.can_edit"
            @input="autosize"
            @blur="save({ subject: form.subject })"
            @keydown.enter.prevent="$event.target.blur()"
          />

          <dl class="mt-4 grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-3 text-sm">
            <dt class="text-ink-gray-5">Status</dt>
            <dd>
              <select v-model="form.status" class="folio-select" :disabled="!task.can_edit" @change="save({ status: form.status })">
                <option v-if="task.status === 'Overdue'" value="Overdue" disabled>Overdue (set by ERPNext)</option>
                <option v-for="s in TASK_STATUSES" :key="s" :value="s">{{ s }}</option>
              </select>
            </dd>

            <dt class="text-ink-gray-5">Assignees</dt>
            <dd class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="a in task.assignees"
                :key="a.user"
                class="flex items-center gap-1.5 rounded-full bg-surface-gray-2 py-0.5 pl-0.5 pr-2 text-sm text-ink-gray-8"
              >
                <Avatar size="xs" :label="a.full_name" :image="a.image" />
                {{ a.full_name }}
                <button v-if="task.can_edit" class="text-ink-gray-5 hover:text-ink-gray-8" :aria-label="`Unassign ${a.full_name}`" @click="unassign(a.user)">
                  <LucideX class="size-3" />
                </button>
              </span>
              <select v-if="task.can_edit" class="folio-select !w-auto" value="" aria-label="Add assignee" @change="assign($event)">
                <option value="" disabled>+ Assign</option>
                <option v-for="u in assignable" :key="u.name" :value="u.name">{{ u.full_name || u.name }}</option>
              </select>
            </dd>

            <dt class="text-ink-gray-5">Priority</dt>
            <dd>
              <select v-model="form.priority" class="folio-select" :disabled="!task.can_edit" @change="save({ priority: form.priority })">
                <option v-for="p in TASK_PRIORITIES" :key="p" :value="p">{{ p }}</option>
              </select>
            </dd>

            <dt class="text-ink-gray-5">Start</dt>
            <dd>
              <input v-model="form.start" type="date" class="folio-select" :max="projectEnd || undefined" :disabled="!task.can_edit" @change="save({ exp_start_date: form.start || null })" />
            </dd>

            <dt class="text-ink-gray-5">Due</dt>
            <dd class="flex items-center gap-2">
              <input v-model="form.due" type="date" class="folio-select" :max="projectEnd || undefined" :disabled="!task.can_edit" @change="save({ exp_end_date: form.due || null })" />
              <span v-if="isOverdue(task)" class="shrink-0 text-xs font-medium text-ink-red-6">Overdue</span>
              <span v-else-if="projectEnd" class="shrink-0 text-xs text-ink-gray-4">Project ends {{ formatDue(projectEnd) }}</span>
            </dd>

            <template v-if="task.completed_by">
              <dt class="text-ink-gray-5">Completed by</dt>
              <dd class="text-ink-gray-8">{{ task.completed_by }}</dd>
            </template>
          </dl>

          <div class="mt-6">
            <div class="mb-1 text-sm text-ink-gray-5">Description</div>
            <TextEditor
              :content="task.description"
              :editable="task.can_edit"
              placeholder="Add details…"
              editor-class="prose-sm min-h-24 max-w-none rounded-md border border-outline-gray-2 px-3 py-2 focus:outline-none"
              @change="onDescription"
            />
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Avatar, Button, LoadingIndicator, TextEditor, call, toast } from 'frappe-ui'
import { TASK_PRIORITIES, TASK_STATUSES, formatDue, isOverdue, setAssignees, updateTask } from '@/data/tasks'
import { debounce } from '@/utils'

const props = defineProps({
  taskName: { type: String, default: null },
  team: { type: Array, default: () => [] },
  // ERPNext refuses task dates after the project's expected end date
  projectEnd: { type: String, default: null },
})
const emit = defineEmits(['close', 'changed'])

const task = ref(null)
const users = ref([])
const saving = ref(false)
const titleInput = ref(null)
const form = reactive({ subject: '', status: '', priority: '', start: '', due: '' })

const assignable = computed(() => {
  const taken = new Set((task.value?.assignees || []).map((a) => a.user))
  const team = props.team.map((t) => ({ name: t.user, full_name: t.full_name }))
  const rest = users.value.filter((u) => !team.some((t) => t.name === u.name))
  return [...team, ...rest].filter((u) => !taken.has(u.name))
})

const dateOnly = (v) => (v ? String(v).slice(0, 10) : '')

function fill(data) {
  task.value = data
  Object.assign(form, {
    subject: data.subject,
    status: data.status,
    priority: data.priority || 'Medium',
    start: dateOnly(data.start),
    due: dateOnly(data.due),
  })
  nextTick(autosize)
}

watch(
  () => props.taskName,
  async (name) => {
    task.value = null
    if (!name) return
    try {
      const [data, list] = await Promise.all([
        call('folio.api.tasks.get_task', { name }),
        users.value.length ? users.value : call('folio.api.workspace.get_users', { limit: 100 }),
      ])
      users.value = list
      if (props.taskName === name) fill(data)
    } catch (e) {
      toast.error(e?.messages?.[0] || 'Could not open the task')
      close()
    }
  },
  { immediate: true },
)

async function run(fn) {
  saving.value = true
  try {
    fill(await fn())
    emit('changed')
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not save the task')
    fill(await call('folio.api.tasks.get_task', { name: props.taskName })) // show what ERPNext kept
  } finally {
    saving.value = false
  }
}

// what the server has, in the same shape as the fields we send
function serverValue(field) {
  const t = task.value
  return {
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    exp_start_date: dateOnly(t.start) || null,
    exp_end_date: dateOnly(t.due) || null,
    description: t.description || null,
  }[field]
}

function save(fields) {
  const changed = Object.entries(fields).filter(([k, v]) => (serverValue(k) ?? null) !== (v ?? null))
  if (changed.length) run(() => updateTask(props.taskName, Object.fromEntries(changed)))
}

const onDescription = debounce((html) => save({ description: html }), 800)

function assign(e) {
  const user = e.target.value
  e.target.value = ''
  if (user) run(() => setAssignees(props.taskName, [...task.value.assignees.map((a) => a.user), user]))
}

function unassign(user) {
  run(() => setAssignees(props.taskName, task.value.assignees.map((a) => a.user).filter((u) => u !== user)))
}

function autosize() {
  const el = titleInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function close() {
  onDescription.flush() // don't lose a description edit that hasn't been sent yet
  emit('close')
}
</script>
