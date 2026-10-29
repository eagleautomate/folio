<template>
  <div
    class="cursor-pointer rounded-md border border-outline-gray-2 bg-surface-base p-2.5 shadow-sm transition-shadow hover:shadow-md"
    :class="{ 'opacity-40': dragging }"
    :draggable="task.can_edit"
    @dragstart="onDragStart"
    @dragend="dragging = false"
    @click="$emit('open', task)"
  >
    <div class="flex items-start gap-2">
      <span class="min-w-0 flex-1 text-base leading-snug text-ink-gray-8" :class="{ 'text-ink-gray-5 line-through': done }">
        {{ task.subject }}
      </span>
      <LucideFlag v-if="overdue" class="mt-0.5 size-3.5 shrink-0 fill-current text-ink-red-6" title="Overdue" />
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-gray-5">
      <span class="whitespace-nowrap">{{ task.name }}</span>
      <span v-if="task.due && !done" class="whitespace-nowrap" :class="{ 'font-medium text-ink-red-6': overdue }">{{ formatDue(task.due) }}</span>
      <Badge v-if="showStatus" size="sm" :theme="statusTheme(task.status)" :label="task.status" />
      <Badge v-if="['High', 'Urgent'].includes(task.priority)" size="sm" :theme="task.priority === 'Urgent' ? 'red' : 'orange'" :label="task.priority" />
      <div v-if="task.assignees.length" class="ml-auto flex -space-x-1.5">
        <Avatar v-for="p in task.assignees" :key="p.user" size="xs" :label="p.full_name" :image="p.image" :title="p.full_name" class="ring-2 ring-outline-base" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Avatar, Badge } from 'frappe-ui'
import { formatDue, isDone, isOverdue, statusTheme } from '@/data/tasks'

const props = defineProps({
  task: { type: Object, required: true },
  showStatus: { type: Boolean, default: false },
})
defineEmits(['open'])

const dragging = ref(false)
const done = computed(() => isDone(props.task))
const overdue = computed(() => isOverdue(props.task))

function onDragStart(e) {
  dragging.value = true
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/x-folio-task', props.task.name)
}
</script>
