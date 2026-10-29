<template>
  <Dialog
    v-model="open"
    :options="{
      title: 'Create a space',
      actions: [{ label: 'Create space', variant: 'solid', onClick: create }],
    }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <div class="flex items-end gap-2">
          <EmojiPicker v-model="icon">
            <button class="flex size-8 items-center justify-center rounded border border-outline-gray-2 text-lg hover:bg-surface-gray-2">
              {{ icon }}
            </button>
          </EmojiPicker>
          <FormControl v-model="title" class="flex-1" label="Name" placeholder="e.g. Engineering" autofocus @keydown.enter="create" />
        </div>
        <FormControl
          v-model="visibility"
          type="select"
          label="Who can see it"
          :options="[
            { label: 'Everyone in the workspace', value: 'Workspace' },
            { label: 'Only members I add', value: 'Private' },
          ]"
        />
        <ErrorMessage :message="error" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Dialog, ErrorMessage, FormControl, call } from 'frappe-ui'
import EmojiPicker from '@/components/EmojiPicker.vue'
import { loadWorkspace } from '@/data/workspace'

const open = defineModel({ type: Boolean, default: false })
const title = ref('')
const icon = ref('📁')
const visibility = ref('Workspace')
const error = ref('')

async function create() {
  if (!title.value.trim()) {
    error.value = 'Give the space a name'
    return
  }
  try {
    await call('folio.api.spaces.create_space', { title: title.value, icon: icon.value, visibility: visibility.value })
    await loadWorkspace()
    open.value = false
    title.value = ''
    error.value = ''
  } catch (e) {
    error.value = e?.messages?.[0] || 'Could not create the space'
  }
}
</script>
