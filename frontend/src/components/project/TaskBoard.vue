<template>
  <div class="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4">
    <section
      v-for="col in columns"
      :key="col.key"
      class="flex w-64 shrink-0 flex-col rounded-lg bg-surface-gray-1 transition-colors"
      :class="{ 'bg-surface-gray-2 ring-2 ring-outline-gray-3': over === col.key }"
      :aria-label="col.label"
      :data-column="col.key"
      @dragover.prevent="onDragOver($event, col)"
      @dragleave="onDragLeave($event, col)"
      @drop.prevent="onDrop($event, col)"
    >
      <header class="flex items-center gap-2 px-3 pb-1 pt-2.5 text-sm">
        <Avatar v-if="col.person" size="xs" :label="col.person.full_name" :image="col.person.image" />
        <span class="font-medium text-ink-gray-8">{{ col.label }}</span>
        <span class="text-ink-gray-5">{{ col.tasks.length }}</span>
      </header>
      <div class="flex min-h-24 flex-1 flex-col gap-2 p-2">
        <TaskCard
          v-for="t in col.tasks"
          :key="t.name"
          :task="t"
          :show-status="groupBy !== 'status'"
          @open="$emit('open', $event)"
        />
        <p v-if="!col.tasks.length" class="px-1 py-2 text-sm text-ink-gray-4">Drop tasks here</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Avatar, toast } from 'frappe-ui'
import TaskCard from './TaskCard.vue'
import { TASK_PRIORITIES, isDone, setAssignees, updateTask } from '@/data/tasks'

const props = defineProps({
  tasks: { type: Array, required: true },
  team: { type: Array, default: () => [] },
  groupBy: { type: String, default: 'status' }, // 'status' | 'assignee' | 'priority'
})
const emit = defineEmits(['open', 'changed'])

const over = ref(null)

// Overdue is set by ERPNext's daily job; those tasks sit in "Open" with a red flag.
const STATUS_COLUMNS = ['Open', 'Working', 'Pending Review', 'Completed']
const statusOf = (t) => (t.status === 'Overdue' ? 'Open' : t.status)

const columns = computed(() => {
  const tasks = props.tasks
  if (props.groupBy === 'assignee') {
    const people = [...props.team]
    for (const t of tasks) for (const a of t.assignees) if (!people.some((p) => p.user === a.user)) people.push(a)
    const cols = people.map((p) => ({
      key: p.user,
      label: p.full_name,
      person: p,
      value: p.user,
      tasks: tasks.filter((t) => t.assignees[0]?.user === p.user), // a card lives under its first assignee
    }))
    cols.push({ key: '__none', label: 'Unassigned', value: null, tasks: tasks.filter((t) => !t.assignees.length) })
    return cols.filter((c) => c.tasks.length || c.key === '__none' || props.team.some((p) => p.user === c.key))
  }
  if (props.groupBy === 'priority') {
    return TASK_PRIORITIES.map((p) => ({ key: p, label: p, value: p, tasks: tasks.filter((t) => (t.priority || 'Medium') === p) }))
  }
  const cols = STATUS_COLUMNS.map((s) => ({ key: s, label: s, value: s, tasks: tasks.filter((t) => statusOf(t) === s) }))
  const cancelled = tasks.filter((t) => t.status === 'Cancelled')
  if (cancelled.length) cols.push({ key: 'Cancelled', label: 'Cancelled', value: 'Cancelled', tasks: cancelled })
  return cols
})

function currentValue(task) {
  if (props.groupBy === 'assignee') return task.assignees[0]?.user ?? null
  if (props.groupBy === 'priority') return task.priority || 'Medium'
  return statusOf(task)
}

function onDragOver(e, col) {
  if (e.dataTransfer.types.includes('text/x-folio-task')) over.value = col.key
}

function onDragLeave(e, col) {
  if (!e.currentTarget.contains(e.relatedTarget) && over.value === col.key) over.value = null
}

async function onDrop(e, col) {
  over.value = null
  const name = e.dataTransfer.getData('text/x-folio-task')
  const task = props.tasks.find((t) => t.name === name)
  if (!task || currentValue(task) === col.value) return
  try {
    if (props.groupBy === 'assignee') await setAssignees(name, col.value ? [col.value] : [])
    else if (props.groupBy === 'priority') await updateTask(name, { priority: col.value })
    else await updateTask(name, { status: col.value })
    if (props.groupBy === 'status' && col.value === 'Completed' && !isDone(task)) toast.success(`Completed “${task.subject}”`)
  } catch (err) {
    toast.error(err?.messages?.[0] || 'Could not move the task')
  } finally {
    emit('changed')
  }
}
</script>
