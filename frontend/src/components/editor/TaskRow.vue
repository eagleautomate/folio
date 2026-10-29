<template>
  <div class="group flex items-center gap-2.5" :class="compact ? 'py-1' : ''">
    <button
      class="flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
      :class="done ? 'border-transparent bg-surface-gray-7 text-ink-base' : 'border-outline-gray-4 hover:border-outline-gray-5'"
      :disabled="!task.can_edit || busy"
      :title="task.can_edit ? (done ? 'Mark as open' : 'Mark as completed') : 'You cannot edit this task in ERPNext'"
      :aria-label="done ? 'Mark as open' : 'Mark as completed'"
      @click="toggle"
    >
      <LucideCheck v-if="done" class="size-3" />
    </button>
    <a
      :href="`/desk/task/${task.name}`"
      target="_blank"
      class="min-w-0 flex-1 truncate text-base text-ink-gray-8 hover:underline"
      :class="{ 'text-ink-gray-5 line-through': done }"
      :title="`Open ${task.name} in ERPNext`"
    >
      {{ task.subject }}
    </a>
    <span v-if="showProject && task.project_name" class="hidden shrink-0 text-xs text-ink-gray-5 sm:inline">
      {{ task.project_name }}
    </span>
    <span v-if="task.due && !done" class="shrink-0 text-xs" :class="overdue ? 'text-ink-red-6' : 'text-ink-gray-5'">
      {{ formatDue(task.due) }}
    </span>
    <div v-if="people.length" class="flex shrink-0 -space-x-1.5">
      <Avatar
        v-for="p in people"
        :key="p.user"
        size="sm"
        :label="p.full_name"
        :image="p.image"
        :title="p.full_name"
        class="ring-2 ring-outline-base"
      />
    </div>
    <Badge size="sm" :theme="statusTheme" :label="task.status" class="shrink-0" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Avatar, Badge, call, toast } from 'frappe-ui'
import { setTask } from '@/data/tasks'

const props = defineProps({
  task: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  showProject: { type: Boolean, default: true },
})
const emit = defineEmits(['updated'])

const busy = ref(false)
const done = computed(() => ['Completed', 'Cancelled'].includes(props.task.status))
const overdue = computed(() => props.task.due && new Date(String(props.task.due).replace(' ', 'T')) < new Date())

// ERPNext closes assignments on completion; show who completed it instead
const people = computed(() => {
  const t = props.task
  if (done.value && t.completed_by) return [{ user: t.completed_by, full_name: t.completed_by, image: null }]
  return t.assignees || []
})

const statusTheme = computed(
  () =>
    ({
      Open: 'gray',
      Working: 'blue',
      'Pending Review': 'orange',
      Overdue: 'red',
      Completed: 'green',
      Cancelled: 'gray',
    })[props.task.status] || 'gray',
)

async function toggle() {
  busy.value = true
  try {
    const updated = await call('folio.api.tasks.set_completed', { name: props.task.name, completed: done.value ? 0 : 1 })
    setTask(updated)
    emit('updated', updated)
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not update the task')
  } finally {
    busy.value = false
  }
}

function formatDue(value) {
  return new Date(String(value).replace(' ', 'T')).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
</script>
