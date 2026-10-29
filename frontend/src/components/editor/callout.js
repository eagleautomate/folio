// Callout block: an emoji + highlighted box holding paragraphs.
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutView from './CalloutView.vue'

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return {
      emoji: { default: '💡', parseHTML: (el) => el.getAttribute('data-emoji') || '💡' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout', 'data-emoji': node.attrs.emoji }), 0]
  },

  addCommands() {
    return {
      setCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(CalloutView)
  },
})
