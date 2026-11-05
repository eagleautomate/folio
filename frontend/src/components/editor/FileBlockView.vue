<template>
  <NodeViewWrapper class="folio-file my-2" :class="{ 'is-selected': selected }" data-drag-handle>
    <div class="overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-base" contenteditable="false">
      <div class="flex items-center gap-3 px-3 py-2.5">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-md" :class="kindStyle.bg">
          <component :is="kindStyle.icon" class="size-5" :class="kindStyle.fg" />
        </span>
        <div class="min-w-0 flex-1">
          <a
            v-if="url"
            :href="url"
            target="_blank"
            rel="noopener"
            class="block truncate text-base font-medium text-ink-gray-9 no-underline hover:underline"
            :title="node.attrs.name"
          >
            {{ node.attrs.name }}
          </a>
          <span v-else class="block truncate text-base font-medium text-ink-gray-7">{{ node.attrs.name }}</span>
          <span class="block text-sm text-ink-gray-5">
            <template v-if="uploading">Uploading…</template>
            <template v-else-if="!url">File unavailable</template>
            <template v-else>{{ [kindStyle.label, formatSize(node.attrs.size)].filter(Boolean).join(' · ') }}</template>
          </span>
        </div>
        <LoadingIndicator v-if="uploading" class="size-4 text-ink-gray-5" />
        <template v-else-if="url">
          <Button v-if="isPdf" variant="ghost" :aria-label="preview ? 'Hide preview' : 'Preview'" :title="preview ? 'Hide preview' : 'Preview'" @click="preview = !preview">
            <template #icon>
              <LucideEyeOff v-if="preview" class="size-4 text-ink-gray-6" />
              <LucideEye v-else class="size-4 text-ink-gray-6" />
            </template>
          </Button>
          <a
            :href="url"
            :download="node.attrs.name"
            class="flex size-7 items-center justify-center rounded text-ink-gray-6 hover:bg-surface-gray-2"
            aria-label="Download"
            title="Download"
          >
            <LucideDownload class="size-4" />
          </a>
        </template>
      </div>
      <iframe
        v-if="preview && url"
        :src="url"
        :title="`Preview of ${node.attrs.name}`"
        class="block h-[70vh] max-h-[720px] w-full border-0 border-t border-outline-gray-1 bg-surface-gray-1"
      />
    </div>
  </NodeViewWrapper>
</template>

<script setup>
import { computed, ref } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Button, LoadingIndicator } from 'frappe-ui'
import { fileKind, formatSize, safeFileUrl } from './fileBlock'
import IconPdf from '~icons/lucide/file-text'
import IconSheet from '~icons/lucide/file-spreadsheet'
import IconDoc from '~icons/lucide/file-type'
import IconSlides from '~icons/lucide/presentation'
import IconArchive from '~icons/lucide/file-archive'
import IconImage from '~icons/lucide/file-image'
import IconFile from '~icons/lucide/file'

const props = defineProps(nodeViewProps)
const preview = ref(false)

const url = computed(() => safeFileUrl(props.node.attrs.url))
const uploading = computed(() => !!props.node.attrs.uploadId)
const kind = computed(() => fileKind(props.node.attrs.name || '', props.node.attrs.mime || ''))
const isPdf = computed(() => kind.value === 'pdf')

const KINDS = {
  pdf: { icon: IconPdf, label: 'PDF', bg: 'bg-surface-red-2', fg: 'text-ink-red-6' },
  sheet: { icon: IconSheet, label: 'Spreadsheet', bg: 'bg-surface-green-2', fg: 'text-ink-green-6' },
  doc: { icon: IconDoc, label: 'Document', bg: 'bg-surface-blue-2', fg: 'text-ink-blue-6' },
  slides: { icon: IconSlides, label: 'Presentation', bg: 'bg-surface-amber-2', fg: 'text-ink-amber-6' },
  archive: { icon: IconArchive, label: 'Archive', bg: 'bg-surface-gray-2', fg: 'text-ink-gray-6' },
  image: { icon: IconImage, label: 'Image', bg: 'bg-surface-gray-2', fg: 'text-ink-gray-6' },
  file: { icon: IconFile, label: '', bg: 'bg-surface-gray-2', fg: 'text-ink-gray-6' },
}
const kindStyle = computed(() => KINDS[kind.value])
</script>
