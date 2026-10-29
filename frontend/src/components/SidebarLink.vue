<template>
  <button
    class="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-base text-ink-gray-7 hover:bg-surface-gray-2"
    :class="{ '!bg-surface-gray-3 font-medium text-ink-gray-9': active }"
  >
    <span class="text-ink-gray-6"><slot name="icon" /></span>
    <span class="flex-1 truncate">{{ label }}</span>
    <slot name="suffix" />
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  active: { type: Boolean, default: false },
})
</script>
