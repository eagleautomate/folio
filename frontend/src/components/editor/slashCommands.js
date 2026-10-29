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
import IconTask from '~icons/lucide/circle-check-big'
import IconProject from '~icons/lucide/folder-kanban'

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
    group: 'ERPNext',
    title: 'Task',
    description: 'Create or link a task (on a project page: in this project)',
    icon: IconTask,
    keywords: ['task', 'erpnext', 'todo', 'assign', 'project'],
    requires: 'erpnext',
    run: (e, r) => e.chain().focus().deleteRange(r).insertTaskBlock().run(),
  },
  {
    group: 'ERPNext',
    title: 'Project',
    description: "A project's status, progress and live task list",
    icon: IconProject,
    keywords: ['project', 'erpnext', 'tasks', 'overview', 'board'],
    requires: 'erpnext',
    hiddenOn: 'projectPage', // a project page already is the project
    run: (e, r) => e.chain().focus().deleteRange(r).insertProjectBlock().run(),
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

export function filterCommands(query, context = {}) {
  const q = (query || '').toLowerCase().trim()
  const available = COMMANDS.filter((c) => (!c.requires || context[c.requires]) && !(c.hiddenOn && context[c.hiddenOn]))
  if (!q) return available
  // Best match first: title starts with the query, then title contains it, then a
  // keyword starts with it. So "/task" picks "Task", not "To-do list" (keyword "task").
  const score = (c) => {
    const title = c.title.toLowerCase()
    if (title.startsWith(q)) return 0
    if (title.includes(q)) return 1
    if (c.keywords.some((k) => k.startsWith(q))) return 2
    return -1
  }
  return available
    .map((c) => [score(c), c])
    .filter(([s]) => s >= 0)
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => ({ ...c, group: undefined })) // groups don't apply to a ranked list
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
        items: ({ query }) => filterCommands(query, this.options.context),
        command: ({ editor, range, props }) => props.run(editor, range, this.options.context),
        render: vueSuggestionRenderer(CommandList),
      }),
    ]
  },
})
