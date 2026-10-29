// @mentions of desk users. Stored as { id: user email, label: full name }.
import Mention from '@tiptap/extension-mention'
import { call } from 'frappe-ui'
import CommandList from './CommandList.vue'
import { vueSuggestionRenderer } from './suggestionRenderer'

export const UserMention = Mention.configure({
  HTMLAttributes: { class: 'folio-mention' },
  renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
  suggestion: {
    char: '@',
    items: async ({ query }) => {
      const users = await call('folio.api.workspace.get_users', { query, limit: 8 })
      return users.map((u) => ({
        id: u.name,
        title: u.full_name || u.name,
        description: u.name,
        image: u.user_image,
      }))
    },
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: { id: props.id, label: props.title } },
          { type: 'text', text: ' ' },
        ])
        .run()
    },
    render: vueSuggestionRenderer(CommandList),
  },
})
