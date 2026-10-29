<template>
  <BubbleMenu
    :editor="editor"
    :should-show="shouldShow"
    :options="{ placement: 'top-start', offset: 8 }"
  >
    <div
      class="flex items-center gap-0.5 rounded-lg border border-outline-gray-2 bg-surface-modal p-1 shadow-xl"
      @mousedown.prevent
    >
      <template v-if="!linkMode">
        <Dropdown :options="turnInto" align="start">
          <template #trigger>
            <button class="flex h-7 items-center gap-1 rounded px-2 text-sm text-ink-gray-7 hover:bg-surface-gray-2">
              {{ currentBlock }}
              <LucideChevronDown class="size-3" />
            </button>
          </template>
        </Dropdown>
        <div class="mx-0.5 h-5 w-px bg-outline-gray-2" />
        <button
          v-for="action in marks"
          :key="action.name"
          class="flex size-7 items-center justify-center rounded text-ink-gray-7 hover:bg-surface-gray-2"
          :class="{ 'bg-surface-gray-3 text-ink-gray-9': editor.isActive(action.name) }"
          :aria-label="action.label"
          :title="action.label"
          @click="action.run()"
        >
          <component :is="action.icon" class="size-4" />
        </button>
        <button
          class="flex size-7 items-center justify-center rounded text-ink-gray-7 hover:bg-surface-gray-2"
          :class="{ 'bg-surface-gray-3 text-ink-gray-9': editor.isActive('link') }"
          aria-label="Link"
          title="Link"
          @click="startLink"
        >
          <LucideLink class="size-4" />
        </button>
      </template>
      <form v-else class="flex items-center gap-1" @submit.prevent="applyLink">
        <input
          ref="linkInput"
          v-model="href"
          class="h-7 w-56 rounded border-0 bg-surface-gray-2 px-2 text-sm focus:ring-0"
          placeholder="Paste a link…"
          @keydown.esc.prevent="linkMode = false"
        />
        <Button size="sm" variant="solid" type="submit" label="Apply" />
        <Button v-if="editor.isActive('link')" size="sm" variant="ghost" icon="lucide-unlink" aria-label="Remove link" @click="removeLink" />
      </form>
    </div>
  </BubbleMenu>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Button, Dropdown } from 'frappe-ui'
import IconBold from '~icons/lucide/bold'
import IconItalic from '~icons/lucide/italic'
import IconUnderline from '~icons/lucide/underline'
import IconStrike from '~icons/lucide/strikethrough'
import IconCode from '~icons/lucide/code'
import IconHighlight from '~icons/lucide/highlighter'

const props = defineProps({ editor: { type: Object, required: true } })

const linkMode = ref(false)
const href = ref('')
const linkInput = ref(null)

const chain = () => props.editor.chain().focus()

const marks = [
  { name: 'bold', label: 'Bold', icon: IconBold, run: () => chain().toggleBold().run() },
  { name: 'italic', label: 'Italic', icon: IconItalic, run: () => chain().toggleItalic().run() },
  { name: 'underline', label: 'Underline', icon: IconUnderline, run: () => chain().toggleUnderline().run() },
  { name: 'strike', label: 'Strikethrough', icon: IconStrike, run: () => chain().toggleStrike().run() },
  { name: 'code', label: 'Inline code', icon: IconCode, run: () => chain().toggleCode().run() },
  { name: 'highlight', label: 'Highlight', icon: IconHighlight, run: () => chain().toggleHighlight().run() },
]

const turnInto = [
  { label: 'Text', icon: 'lucide-type', onClick: () => chain().setParagraph().run() },
  { label: 'Heading 1', icon: 'lucide-heading-1', onClick: () => chain().setHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: 'lucide-heading-2', onClick: () => chain().setHeading({ level: 2 }).run() },
  { label: 'Heading 3', icon: 'lucide-heading-3', onClick: () => chain().setHeading({ level: 3 }).run() },
  { label: 'Bulleted list', icon: 'lucide-list', onClick: () => chain().toggleBulletList().run() },
  { label: 'Numbered list', icon: 'lucide-list-ordered', onClick: () => chain().toggleOrderedList().run() },
  { label: 'To-do list', icon: 'lucide-list-checks', onClick: () => chain().toggleTaskList().run() },
  { label: 'Quote', icon: 'lucide-quote', onClick: () => chain().toggleBlockquote().run() },
  { label: 'Code', icon: 'lucide-code', onClick: () => chain().toggleCodeBlock().run() },
]

const currentBlock = computed(() => {
  const e = props.editor
  for (const level of [1, 2, 3]) if (e.isActive('heading', { level })) return `Heading ${level}`
  if (e.isActive('taskList')) return 'To-do list'
  if (e.isActive('bulletList')) return 'Bulleted list'
  if (e.isActive('orderedList')) return 'Numbered list'
  if (e.isActive('blockquote')) return 'Quote'
  if (e.isActive('codeBlock')) return 'Code'
  return 'Text'
})

function shouldShow({ editor, state }) {
  const { empty } = state.selection
  if (empty || !editor.isEditable) {
    linkMode.value = false
    return false
  }
  return !editor.isActive('codeBlock') && !editor.isActive('image') && !editor.isActive('pageLink')
}

async function startLink() {
  href.value = props.editor.getAttributes('link').href || ''
  linkMode.value = true
  await nextTick()
  linkInput.value?.focus()
}

function applyLink() {
  const url = href.value.trim()
  if (url) chain().extendMarkRange('link').setLink({ href: url }).run()
  else chain().extendMarkRange('link').unsetLink().run()
  linkMode.value = false
}

function removeLink() {
  chain().extendMarkRange('link').unsetLink().run()
  linkMode.value = false
}
</script>
