<template>
  <NodeViewWrapper class="folio-page-link" :class="{ 'is-selected': selected }" data-drag-handle>
    <router-link
      :to="{ name: 'Page', params: { name: node.attrs.page } }"
      class="flex items-center gap-2 rounded px-1 py-1 text-ink-gray-8 no-underline hover:bg-surface-gray-2"
      contenteditable="false"
    >
      <span v-if="page?.icon" class="w-5 text-center">{{ page.icon }}</span>
      <LucideFileText v-else class="size-[18px] text-ink-gray-5" />
      <span class="border-b border-outline-gray-3 font-medium" :class="{ 'text-ink-gray-4 line-through': missing }">
        {{ missing ? node.attrs.title || 'Deleted page' : pageTitle(page) }}
      </span>
    </router-link>
  </NodeViewWrapper>
</template>

<script setup>
import { computed } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { pagesByName } from '@/data/workspace'
import { pageTitle } from '@/utils'

const props = defineProps(nodeViewProps)
const page = computed(() => pagesByName.value[props.node.attrs.page])
const missing = computed(() => !page.value)
</script>
