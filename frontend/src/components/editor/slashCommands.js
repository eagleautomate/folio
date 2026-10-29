// "/" menu: type a slash at the start of a block (or after a space) to insert blocks.
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import CommandList from './CommandList.vue'
import { vueSuggestionRenderer } from './suggestionRenderer'

import IconText from '~icons/lucide/type'
import IconH1 from '~icons/lucide/heading-1'
import IconH2 from '~icons/lucide/heading-2'
import IconH3 from '~icons/lucide/heading-3'
import IconBullets from '~icons/lucide/list'
import IconNumbers from '~icons/lucide/list-ordered'
import IconTodo from '~icons/lucide/list-checks'
import IconQuote from '~icons/lucide/quote'
import IconCallout from '~icons/lucide/message-square-warning'
import IconDivider from '~icons/lucide/minus'
import IconCode from '~icons/lucide/code'
import IconTable from '~icons/lucide/table'
import IconImage from '~icons/lucide/image'
import IconPage from '~icons/lucide/file-text'

// `run(editor, range, ctx)` performs the insert; ctx carries page-level callbacks
// (creating sub-pages, uploading images) supplied by Editor.vue.
export const COMMANDS = [
  {
    group: 'Basic blocks',
    title: 'Text',
    description: 'Plain paragraph',
    icon: IconText,
    keywords: ['paragraph', 'p'],
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    group: 'Basic blocks',
    title: 'Heading 1',
    description: 'Big section heading',
    icon: IconH1,
    keywords: ['h1', 'title'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run(),
  },
  {
    group: 'Basic blocks',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: IconH2,
    keywords: ['h2', 'subtitle'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run(),
  },
  {
    group: 'Basic blocks',
    title: 'Heading 3',
    description: 'Small section heading',
    icon: IconH3,
    keywords: ['h3'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run(),
  },
  {
    group: 'Basic blocks',
    title: 'Bulleted list',
    description: 'Simple bulleted list',
    icon: IconBullets,
    keywords: ['ul', 'bullet', 'unordered'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    group: 'Basic blocks',
    title: 'Numbered list',
    description: 'List with numbering',
    icon: IconNumbers,
    keywords: ['ol', 'ordered', 'number'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    group: 'Basic blocks',
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: IconTodo,
    keywords: ['todo', 'task', 'checkbox', 'check'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    group: 'Basic blocks',
    title: 'Page',
    description: 'Embed a sub-page inside this page',
    icon: IconPage,
    keywords: ['subpage', 'page', 'link', 'child'],
    run: (e, r, ctx) => {
      e.chain().focus().deleteRange(r).run()
      ctx?.createSubPage?.()
    },
  },
  {
    group: 'Basic blocks',
    title: 'Quote',
    description: 'Capture a quote',
    icon: IconQuote,
    keywords: ['blockquote', 'citation'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    group: 'Basic blocks',
    title: 'Callout',
    description: 'Make writing stand out',
    icon: IconCallout,
    keywords: ['note', 'info', 'warning', 'tip'],
    run: (e, r) => e.chain().focus().deleteRange(r).setCallout().run(),
  },
  {
    group: 'Basic blocks',
    title: 'Divider',
    description: 'Visually divide blocks',
    icon: IconDivider,
    keywords: ['hr', 'rule', 'line', 'separator'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    group: 'Advanced',
    title: 'Code',
    description: 'Code block with syntax highlighting',
    icon: IconCode,
    keywords: ['codeblock', 'snippet', 'pre'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    group: 'Advanced',
    title: 'Table',
    description: 'Simple table with a header row',
    icon: IconTable,
    keywords: ['grid', 'rows', 'columns'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    group: 'Media',
    title: 'Image',
    description: 'Upload an image',
    icon: IconImage,
    keywords: ['picture', 'photo', 'upload', 'img'],
    run: (e, r, ctx) => {
      e.chain().focus().deleteRange(r).run()
      ctx?.pickImage?.()
    },
  },
]

export function filterCommands(query) {
  const q = (query || '').toLowerCase().trim()
  if (!q) return COMMANDS
  return COMMANDS.filter(
    (c) => c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.startsWith(q)),
  )
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return { context: {} }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey('slashCommands'),
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        allow: ({ state, range }) => {
          // not inside code blocks
          const $from = state.doc.resolve(range.from)
          return $from.parent.type.name !== 'codeBlock'
        },
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props }) => props.run(editor, range, this.options.context),
        render: vueSuggestionRenderer(CommandList),
      }),
    ]
  },
})
