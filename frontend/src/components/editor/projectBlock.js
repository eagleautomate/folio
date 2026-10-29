// ERPNext Project card ("/project" on ordinary pages): live status, progress and
// task counts, linking to the project's page, which owns the task list. Hidden on
// project pages. Stores only the Project name; the rest is read live.
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ProjectBlockView from './ProjectBlockView.vue'

export const ProjectBlock = Node.create({
  name: 'erpnextProject',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { context: {} }
  },

  addAttributes() {
    return {
      project: { default: null, parseHTML: (el) => el.getAttribute('data-project') },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="erpnext-project"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'erpnext-project', 'data-project': node.attrs.project }),
      node.attrs.project || 'Project',
    ]
  },

  addCommands() {
    return {
      insertProjectBlock:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ProjectBlockView)
  },
})
