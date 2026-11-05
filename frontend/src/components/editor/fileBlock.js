// File block: an uploaded document (PDF, Word, spreadsheet…) shown as a card with
// open / download, and an inline preview for PDFs. The file itself is a private
// Frappe File attached to the page, so it follows the page's access.
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import FileBlockView from './FileBlockView.vue'

// Only Frappe file paths (or plain web links) are ever rendered as a link: pasted HTML
// could carry `javascript:` URLs otherwise.
export function safeFileUrl(url) {
  if (typeof url !== 'string') return null
  return /^(\/files\/|\/private\/files\/|https?:\/\/)/.test(url) ? url : null
}

export const FileBlock = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: null, parseHTML: (el) => safeFileUrl(el.getAttribute('data-url')) },
      name: { default: 'File', parseHTML: (el) => el.getAttribute('data-name') || 'File' },
      size: { default: null, parseHTML: (el) => Number(el.getAttribute('data-size')) || null },
      mime: { default: null, parseHTML: (el) => el.getAttribute('data-mime') },
      // set while the upload runs, so the finished upload can find its card again
      uploadId: { default: null, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { url, name, size, mime } = node.attrs
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'file', 'data-url': safeFileUrl(url), 'data-name': name, 'data-size': size, 'data-mime': mime }),
      ['a', { href: safeFileUrl(url) || '#' }, name],
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(FileBlockView)
  },
})

// Insert at the cursor, but never over a selected block: clicking a file card (or an
// image) selects it, and inserting would replace it. Then the new block goes after it.
export function insertBlock(editor, content) {
  const { selection } = editor.state
  const chain = editor.chain().focus()
  return (selection.node ? chain.insertContentAt(selection.to, content) : chain.insertContent(content)).run()
}

// Insert a card for `file` right away and fill in its URL when the upload finishes;
// the card is removed again if the upload fails.
export async function insertUploadedFile(editor, file, upload) {
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  insertBlock(editor, { type: 'fileAttachment', attrs: { name: file.name, size: file.size, mime: file.type || null, uploadId } })

  const find = () => {
    let found = null
    editor.state.doc.descendants((node, pos) => {
      if (found === null && node.type.name === 'fileAttachment' && node.attrs.uploadId === uploadId) found = { node, pos }
      return found === null
    })
    return found
  }

  try {
    const url = await upload(file)
    const hit = find()
    if (hit) editor.view.dispatch(editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.node.attrs, url, uploadId: null }))
  } catch (e) {
    const hit = find()
    if (hit) editor.view.dispatch(editor.state.tr.delete(hit.pos, hit.pos + hit.node.nodeSize))
    throw e
  }
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// What kind of file it is, from the MIME type or the extension: drives the icon and label.
export function fileKind(name = '', mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (/^(xlsx?|csv|ods|numbers)$/.test(ext) || /spreadsheet|excel|csv/.test(mime)) return 'sheet'
  if (/^(docx?|odt|rtf|txt|md|pages)$/.test(ext) || /word|text\//.test(mime)) return 'doc'
  if (/^(pptx?|odp|key)$/.test(ext) || /presentation|powerpoint/.test(mime)) return 'slides'
  if (/^(zip|rar|7z|gz|tar)$/.test(ext) || /zip|compressed|archive/.test(mime)) return 'archive'
  if (/^(png|jpe?g|gif|webp|svg|heic)$/.test(ext) || mime.startsWith('image/')) return 'image'
  return 'file'
}
