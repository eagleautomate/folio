<template>
  <div class="overflow-x-auto rounded-lg border border-outline-gray-1">
    <table class="w-full min-w-[720px] table-fixed text-left text-sm">
      <colgroup>
        <col class="w-10" />
        <col />
        <col class="w-32" />
        <col class="w-36" />
        <col class="w-24" />
        <col class="w-24" />
        <col class="w-40" />
      </colgroup>
      <thead class="bg-surface-gray-1 text-xs text-ink-gray-5">
        <tr>
          <th class="px-3 py-2" />
          <th v-for="c in sortable" :key="c.key" class="px-2 py-2 font-medium">
            <button class="flex items-center gap-1 hover:text-ink-gray-8" @click="sortBy(c.key)">
              {{ c.label }}
              <LucideArrowUp v-if="sort.key === c.key && sort.asc" class="size-3" />
              <LucideArrowDown v-else-if="sort.key === c.key" class="size-3" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-gray-1">
        <tr
          v-for="t in rows"
          :key="t.name"
          class="cursor-pointer hover:bg-surface-gray-1"
          :class="{ 'text-ink-gray-5': isDone(t) }"
          @click="$emit('open', t)"
        >
          <td class="px-3 py-1.5" @click.stop>
            <TaskCheck :task="t" @updated="$emit('changed')" />
          </td>
          <td class="truncate px-2 py-1.5 text-base text-ink-gray-8" :class="{ 'text-ink-gray-5 line-through': isDone(t) }">
            {{ t.subject }}
          </td>
          <td class="px-2 py-1.5"><Badge size="sm" :theme="statusTheme(t.status)" :label="t.status" /></td>
          <td class="truncate px-2 py-1.5">
            <span v-if="t.assignees.length" class="flex items-center gap-1.5">
              <Avatar size="xs" :label="t.assignees[0].full_name" :image="t.assignees[0].image" />
              <span class="truncate">{{ t.assignees[0].full_name }}</span>
              <span v-if="t.assignees.length > 1" class="text-ink-gray-5">+{{ t.assignees.length - 1 }}</span>
            </span>
            <span v-else class="text-ink-gray-4">—</span>
          </td>
          <td class="px-2 py-1.5">{{ t.priority || '—' }}</td>
          <td class="px-2 py-1.5" :class="{ 'font-medium text-ink-red-6': isOverdue(t) }">{{ t.due ? formatDue(t.due) : '—' }}</td>
          <td class="truncate px-2 py-1.5 text-ink-gray-5">{{ t.name }}</td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="7" class="px-3 py-6 text-center text-base text-ink-gray-5">No tasks match.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { Avatar, Badge } from 'frappe-ui'
import TaskCheck from './TaskCheck.vue'
import { TASK_PRIORITIES, TASK_STATUSES, formatDue, isDone, isOverdue, statusTheme } from '@/data/tasks'

const props = defineProps({ tasks: { type: Array, required: true } })
defineEmits(['open', 'changed'])

const sortable = [
  { key: 'subject', label: 'Task' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due' },
  { key: 'name', label: 'ID' },
]
const sort = reactive({ key: 'due', asc: true })

function sortBy(key) {
  if (sort.key === key) sort.asc = !sort.asc
  else Object.assign(sort, { key, asc: true })
}

const rank = {
  status: (t) => (t.status === 'Overdue' ? -1 : TASK_STATUSES.indexOf(t.status)),
  priority: (t) => TASK_PRIORITIES.indexOf(t.priority || 'Medium'),
  assignee: (t) => t.assignees[0]?.full_name?.toLowerCase() || '\uffff',
  due: (t) => t.due || '9999',
  subject: (t) => t.subject.toLowerCase(),
  name: (t) => t.name,
}

const rows = computed(() => {
  const key = rank[sort.key]
  return [...props.tasks].sort((a, b) => {
    const x = key(a)
    const y = key(b)
    return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1)
  })
})
</script>
