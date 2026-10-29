<template>
  <div
    class="max-h-80 w-72 overflow-y-auto rounded-lg border border-outline-gray-2 bg-surface-elevation-2 p-1 shadow-xl"
    @mousedown.prevent
  >
    <template v-if="items.length">
      <template v-for="(item, index) in items" :key="item.title">
        <div
          v-if="item.group && item.group !== items[index - 1]?.group"
          class="px-2 pb-1 pt-2 text-xs font-medium text-ink-gray-5"
        >
          {{ item.group }}
        </div>
        <button
          :ref="(el) => (buttons[index] = el)"
          class="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left"
          :class="index === selected ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
          @mouseenter="selected = index"
          @click="select(index)"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded border border-outline-gray-1 bg-surface-base text-ink-gray-7"
          >
            <img v-if="item.image" :src="item.image" class="size-8 rounded object-cover" alt="" />
            <span v-else-if="item.emoji" class="text-base">{{ item.emoji }}</span>
            <component :is="item.icon" v-else-if="item.icon" class="size-4" />
            <span v-else class="text-sm font-medium">{{ initials(item.title) }}</span>
          </span>
          <span class="min-w-0">
            <span class="block truncate text-base text-ink-gray-8">{{ item.title }}</span>
            <span v-if="item.description" class="block truncate text-xs text-ink-gray-5">{{ item.description }}</span>
          </span>
        </button>
      </template>
    </template>
    <div v-else class="px-2 py-2 text-base text-ink-gray-5">{{ loading ? 'Loading…' : 'No results' }}</div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  command: { type: Function, required: true },
  loading: { type: Boolean, default: false },
})

const selected = ref(0)
const buttons = ref([])

watch(
  () => props.items,
  () => (selected.value = 0),
)

watch(selected, async (i) => {
  await nextTick()
  buttons.value[i]?.scrollIntoView({ block: 'nearest' })
})

function select(index) {
  const item = props.items[index]
  if (item) props.command(item)
}

function initials(title) {
  return (title || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function onKeyDown(event) {
  const n = props.items.length
  if (!n) return false
  if (event.key === 'ArrowDown') {
    selected.value = (selected.value + 1) % n
    return true
  }
  if (event.key === 'ArrowUp') {
    selected.value = (selected.value - 1 + n) % n
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    select(selected.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>
