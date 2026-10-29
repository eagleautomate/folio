<template>
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
</template>

<script setup>
import { computed, ref } from 'vue'
import { call, toast } from 'frappe-ui'
import { isDone, setTask } from '@/data/tasks'

const props = defineProps({ task: { type: Object, required: true } })
const emit = defineEmits(['updated'])

const busy = ref(false)
const done = computed(() => isDone(props.task))

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
</script>
