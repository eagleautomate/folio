// ERPNext Project block: live summary of a project and its task list. Inserted at
// the top of every auto-created project page, or with "/project". Stores only the
// Project name; everything else is read live (folio.api.projects.get_project).
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
