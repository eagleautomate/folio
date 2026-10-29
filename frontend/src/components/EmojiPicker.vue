<template>
  <Popover v-model:open="open" align="start">
    <template #trigger>
      <slot />
    </template>
    <template #default>
      <div class="w-72 p-2">
        <div class="mb-1 flex items-center justify-between px-1">
          <span class="text-xs font-medium text-ink-gray-5">Icon</span>
          <button v-if="removable && model" class="text-xs text-ink-gray-5 hover:text-ink-gray-8" @click="pick(null)">
            Remove
          </button>
        </div>
        <div class="grid max-h-56 grid-cols-9 gap-0.5 overflow-y-auto">
          <button
            v-for="emoji in EMOJIS"
            :key="emoji"
            class="flex size-7 items-center justify-center rounded text-lg hover:bg-surface-gray-3"
            @click="pick(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { ref } from 'vue'
import { Popover } from 'frappe-ui'
import { EMOJIS } from '@/utils'

const model = defineModel({ type: String, default: null })
defineProps({ removable: { type: Boolean, default: false } })
const emit = defineEmits(['select'])
const open = ref(false)

function pick(emoji) {
  model.value = emoji
  emit('select', emoji)
  open.value = false
}
</script>
