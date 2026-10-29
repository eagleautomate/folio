// The full TipTap extension set for Folio pages. Keep this the single place
// where blocks are registered, so the editor, read-only views and any future
// server-side renderer agree on the schema.
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { SlashCommands } from './slashCommands'
import { Callout } from './callout'
import { PageLink } from './pageLink'
import { UserMention } from './mention'
import { TaskBlock } from './taskBlock'

const lowlight = createLowlight(common)

export function buildExtensions({ context = {} } = {}) {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      dropcursor: { color: '#3b82f6', width: 2 },
    }),
    Placeholder.configure({
      includeChildren: false,
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return `Heading ${node.attrs.level}`
        return "Write, or press '/' for commands…"
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Image.configure({ HTMLAttributes: { class: 'folio-image' } }),
    Highlight.configure({ multicolor: false }),
    Typography,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
    Callout,
    PageLink,
    UserMention,
    TaskBlock.configure({ context }),
    SlashCommands.configure({ context }),
  ]
}
