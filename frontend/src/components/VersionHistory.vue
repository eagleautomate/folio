<template>
  <Dialog v-model="open" :options="{ size: '5xl' }">
    <template #body>
      <div class="flex h-[75vh]">
        <div class="min-w-0 flex-1 overflow-y-auto px-10 py-8">
          <LoadingIndicator v-if="version.loading" class="mx-auto size-5 text-ink-gray-5" />
          <template v-else-if="version.data">
            <h1 class="mb-4 text-3xl font-bold text-ink-gray-9">{{ version.data.title || 'Untitled' }}</h1>
            <div class="folio-prose pointer-events-none !min-h-0 !pb-0" v-html="previewHtml" />
          </template>
          <p v-else class="mt-20 text-center text-base text-ink-gray-5">Select a version to preview it</p>
        </div>
        <aside class="flex w-64 shrink-0 flex-col border-l border-outline-gray-1 bg-surface-gray-1">
          <div class="px-4 pb-2 pt-4 text-base font-semibold text-ink-gray-8">Version history</div>
          <div class="flex-1 overflow-y-auto px-2">
            <div v-if="!versions.data?.length && !versions.loading" class="px-2 text-sm text-ink-gray-5">
              No versions yet. Versions are kept as you edit.
            </div>
            <button
              v-for="v in versions.data"
              :key="v.name"
              class="w-full rounded px-2 py-1.5 text-left"
              :class="v.name === selected ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
              @click="select(v.name)"
            >
              <div class="text-base text-ink-gray-8">{{ formatDate(v.modified) }}</div>
              <div class="truncate text-xs text-ink-gray-5">{{ v.owner }}</div>
            </button>
          </div>
          <div class="border-t border-outline-gray-1 p-3">
            <Button
              class="w-full"
              variant="solid"
              label="Restore this version"
              :disabled="!selected"
              :loading="restoring"
              @click="restore"
            />
          </div>
        </aside>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { generateHTML } from '@tiptap/core'
import { Button, Dialog, LoadingIndicator, call, createResource, toast } from 'frappe-ui'
import { buildExtensions } from '@/components/editor/extensions'
import { clock, parseServerDate } from '@/utils'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({ page: { type: String, required: true } })
const emit = defineEmits(['restored'])

const selected = ref(null)
const restoring = ref(false)
const extensions = buildExtensions()

const versions = createResource({ url: 'folio.api.pages.get_versions', makeParams: () => ({ name: props.page }) })
const version = createResource({ url: 'folio.api.pages.get_version' })

const previewHtml = computed(() => {
  const content = version.data?.content
  if (!content) return ''
  try {
    return generateHTML(content, extensions)
  } catch {
    return '<p>(This version could not be displayed)</p>'
  }
})

watch(open, async (value) => {
  if (!value) return
  selected.value = null
  version.reset()
  await versions.reload()
  if (versions.data?.length) select(versions.data[0].name)
})

function select(name) {
  selected.value = name
  version.submit({ name })
}

async function restore() {
  restoring.value = true
  try {
    const data = await call('folio.api.pages.restore_version', { name: selected.value })
    emit('restored', data)
    toast.success('Version restored')
    open.value = false
  } finally {
    restoring.value = false
  }
}

function formatDate(value) {
  return new Date(parseServerDate(value).getTime() + clock.offset).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>
