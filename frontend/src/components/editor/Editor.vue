<template>
  <div class="folio-editor relative">
    <template v-if="editor && editable">
      <DragHandle :editor="editor" class="folio-drag-handle">
        <button class="flex h-6 w-5 items-center justify-center rounded text-ink-gray-4 hover:bg-surface-gray-3" aria-label="Drag block">
          <LucideGripVertical class="size-4" />
        </button>
      </DragHandle>
      <FormattingMenu :editor="editor" />
    </template>
    <EditorContent :editor="editor" />
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilePicked" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'
import { toast } from 'frappe-ui'
import { buildExtensions } from './extensions'
import FormattingMenu from './FormattingMenu.vue'
import { uploadFile } from '@/utils/upload'
import { state } from '@/data/workspace'

const props = defineProps({
  content: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  pageName: { type: String, required: true },
  // set on a project page: tasks belong to this project and /project is hidden
  projectPage: { type: String, default: null },
})
const emit = defineEmits(['update', 'create-sub-page'])

const fileInput = ref(null)

// Callbacks the slash menu can trigger; they need the page context.
const context = {
  pageName: props.pageName,
  projectPage: props.projectPage,
  erpnext: !!state.boot?.erpnext_installed,
  createSubPage: () => emit('create-sub-page'),
  pickImage: () => fileInput.value?.click(),
}

const editor = useEditor({
  content: props.content || '',
  editable: props.editable,
  extensions: buildExtensions({ context }),
  editorProps: {
    attributes: { class: 'folio-prose focus:outline-none' },
    handlePaste: (view, event) => handleFiles(event.clipboardData?.files),
    handleDrop: (view, event, slice, moved) => !moved && handleFiles(event.dataTransfer?.files),
  },
  onUpdate: ({ editor }) => emit('update', editor.getJSON()),
})

watch(
  () => props.editable,
  (value) => editor.value?.setEditable(value),
)

function handleFiles(files) {
  const images = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
  if (!images.length) return false
  images.forEach(insertImage)
  return true
}

async function insertImage(file) {
  try {
    const url = await uploadFile(file, { doctype: 'Folio Page', docname: props.pageName })
    editor.value?.chain().focus().setImage({ src: url, alt: file.name }).run()
  } catch (e) {
    toast.error(e?.message || 'Upload failed')
  }
}

function onFilePicked(event) {
  const file = event.target.files?.[0]
  if (file) insertImage(file)
  event.target.value = ''
}

function focus(position = 'start') {
  // TipTap's focus command defers to the next animation frame; focus the DOM
  // now so keys typed right after Enter in the title land in the editor.
  editor.value?.view.focus()
  editor.value?.commands.focus(position)
}

function setContent(content) {
  editor.value?.commands.setContent(content || '', { emitUpdate: false })
}

function insertPageLink(page) {
  editor.value?.chain().focus().insertPageLink({ page: page.name, title: page.title }).run()
}

defineExpose({ focus, setContent, insertPageLink, editor })

onBeforeUnmount(() => editor.value?.destroy())
</script>
