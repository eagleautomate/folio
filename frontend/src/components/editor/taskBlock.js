// ERPNext Task block (inserted by "/task"). Stores the Task name and a cached
// subject (for search and for display while loading); status, assignees etc. are
// always read live from ERPNext. A block without a task is a draft: it shows an
// input to create a new Task or link an existing one.
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import TaskBlockView from './TaskBlockView.vue'

export const TaskBlock = Node.create({
  name: 'erpnextTask',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { context: {} }
  },

  addAttributes() {
    return {
      task: { default: null, parseHTML: (el) => el.getAttribute('data-task') },
      subject: { default: '', parseHTML: (el) => el.textContent },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="erpnext-task"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'erpnext-task', 'data-task': node.attrs.task }),
      node.attrs.subject || 'Task',
    ]
  },

  addCommands() {
    return {
      insertTaskBlock:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(TaskBlockView)
  },
})
