<template>
  <NodeViewWrapper class="folio-callout" data-type="callout">
    <EmojiPicker :model-value="node.attrs.emoji" @select="(e) => updateAttributes({ emoji: e || '💡' })">
      <button class="folio-callout-emoji" contenteditable="false" :disabled="!editor.isEditable">
        {{ node.attrs.emoji }}
      </button>
    </EmojiPicker>
    <NodeViewContent class="folio-callout-content" />
  </NodeViewWrapper>
</template>

<script setup>
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from '@tiptap/vue-3'
import EmojiPicker from '@/components/EmojiPicker.vue'

defineProps(nodeViewProps)
</script>
