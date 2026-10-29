// Block that links to another Folio page (inserted by "/page"). Stores only the
// page name; the title and icon are read live from the sidebar store.
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import PageLinkView from './PageLinkView.vue'

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      page: { default: null, parseHTML: (el) => el.getAttribute('data-page') },
      title: { default: '', parseHTML: (el) => el.textContent },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-type="page-link"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-link',
        'data-page': node.attrs.page,
        href: `/folio/p/${node.attrs.page}`,
      }),
      node.attrs.title || 'Untitled',
    ]
  },

  addCommands() {
    return {
      insertPageLink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(PageLinkView)
  },
})
