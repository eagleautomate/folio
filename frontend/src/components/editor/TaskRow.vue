<template>
  <div class="group flex items-center gap-2.5" :class="compact ? 'py-1' : ''">
    <TaskCheck :task="task" @updated="(t) => $emit('updated', t)" />
    <!-- with an @open listener (Tasks tab) the title opens the side panel, else the Desk form -->
    <component
      :is="openable ? 'button' : 'a'"
      v-bind="openable ? { type: 'button' } : { href: `/desk/task/${task.name}`, target: '_blank', title: `Open ${task.name} in ERPNext` }"
      class="min-w-0 flex-1 truncate text-left text-base text-ink-gray-8 hover:underline"
      :class="{ 'text-ink-gray-5 line-through': done }"
      @click="openable && $emit('open', task)"
    >
      {{ task.subject }}
    </component>
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
import { computed } from 'vue'
import { Avatar, Badge } from 'frappe-ui'
import TaskCheck from '@/components/project/TaskCheck.vue'
import { formatDue, isDone, isOverdue, statusTheme as themeFor } from '@/data/tasks'

const props = defineProps({
  task: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  showProject: { type: Boolean, default: true },
  openable: { type: Boolean, default: false },
})
defineEmits(['updated', 'open'])

const done = computed(() => isDone(props.task))
const overdue = computed(() => isOverdue(props.task))

// ERPNext closes assignments on completion; show who completed it instead
const people = computed(() => {
  const t = props.task
  if (done.value && t.completed_by) return [{ user: t.completed_by, full_name: t.completed_by, image: null }]
  return t.assignees || []
})

const statusTheme = computed(() => themeFor(props.task.status))
</script>
