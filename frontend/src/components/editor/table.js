// Tables: cell background colours, and the actions behind the row / column / table
// handles (TableControls.vue). Everything works on a table position plus row/column
// indexes, re-read from the current document when an action runs.
import { TableCell, TableHeader } from '@tiptap/extension-table'
import { TableMap, addColumn, addRow, moveTableColumn, moveTableRow, removeColumn, removeRow } from '@tiptap/pm/tables'
import { TextSelection } from '@tiptap/pm/state'

// Notion-like light tints. Stored as a name (never raw CSS), drawn by editor.css.
export const CELL_COLORS = [
  { name: null, label: 'Default', swatch: '#ffffff' },
  { name: 'gray', label: 'Gray', swatch: '#f1f1ef' },
  { name: 'brown', label: 'Brown', swatch: '#f4eeee' },
  { name: 'orange', label: 'Orange', swatch: '#fbecdd' },
  { name: 'yellow', label: 'Yellow', swatch: '#fbf3db' },
  { name: 'green', label: 'Green', swatch: '#edf3ec' },
  { name: 'blue', label: 'Blue', swatch: '#e7f3f8' },
  { name: 'purple', label: 'Purple', swatch: '#f6f3f9' },
  { name: 'pink', label: 'Pink', swatch: '#faf1f5' },
  { name: 'red', label: 'Red', swatch: '#fdebec' },
]
const COLOR_NAMES = new Set(CELL_COLORS.map((c) => c.name).filter(Boolean))

const background = {
  default: null,
  parseHTML: (el) => (COLOR_NAMES.has(el.getAttribute('data-background')) ? el.getAttribute('data-background') : null),
  renderHTML: (attrs) => (COLOR_NAMES.has(attrs.background) ? { 'data-background': attrs.background } : {}),
}
export const ColoredCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), background }
  },
})
export const ColoredHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), background }
  },
})

// ---- reading a table

// Where a cell element sits: its table and its (row, column) in the table grid.
export function locateCell(view, cellEl) {
  let pos
  try {
    pos = view.posAtDOM(cellEl, 0)
  } catch {
    return null
  }
  const $pos = view.state.doc.resolve(pos)
  for (let d = $pos.depth; d > 1; d--) {
    const role = $pos.node(d).type.spec.tableRole
    if (role === 'cell' || role === 'header_cell') {
      const table = $pos.node(d - 2)
      const tableStart = $pos.start(d - 2)
      const map = TableMap.get(table)
      const rect = map.findCell($pos.before(d) - tableStart)
      return { tablePos: tableStart - 1, row: rect.top, col: rect.left }
    }
  }
  return null
}

// The table at `tablePos` in the current document, with its grid map.
export function tableAt(state, tablePos) {
  const table = state.doc.nodeAt(tablePos)
  if (!table || table.type.spec.tableRole !== 'table') return null
  return { table, tableStart: tablePos + 1, map: TableMap.get(table) }
}

export function hasMergedCells(table) {
  let merged = false
  table.descendants((node) => {
    if ((node.attrs.colspan || 1) > 1 || (node.attrs.rowspan || 1) > 1) merged = true
    return !merged
  })
  return merged
}

// Positions of the distinct cells in a row or a column (merged cells once).
function cellPositions(t, { row = null, col = null }) {
  const { map, tableStart } = t
  const offsets = new Set()
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      if ((row === null || r === row) && (col === null || c === col)) offsets.add(map.map[r * map.width + c])
    }
  }
  return [...offsets].map((o) => tableStart + o).sort((a, b) => b - a) // last first: positions stay valid
}

// ---- actions (each returns false when it can't run)

function run(editor, tablePos, fn) {
  const t = tableAt(editor.state, tablePos)
  if (!t) return false
  const tr = editor.state.tr
  if (fn(tr, t) === false) return false
  editor.view.dispatch(tr.scrollIntoView())
  editor.view.focus()
  return true
}

export const insertColumn = (editor, tablePos, col) => run(editor, tablePos, (tr, t) => addColumn(tr, t, col))
export const insertRow = (editor, tablePos, row) => run(editor, tablePos, (tr, t) => addRow(tr, t, row))

export function deleteColumn(editor, tablePos, col) {
  const t = tableAt(editor.state, tablePos)
  if (t?.map.width === 1) return deleteTable(editor, tablePos)
  return run(editor, tablePos, (tr, t) => removeColumn(tr, t, col))
}

export function deleteRow(editor, tablePos, row) {
  const t = tableAt(editor.state, tablePos)
  if (t?.map.height === 1) return deleteTable(editor, tablePos)
  return run(editor, tablePos, (tr, t) => removeRow(tr, t, row))
}

export function deleteTable(editor, tablePos) {
  return run(editor, tablePos, (tr, t) => {
    tr.delete(tablePos, tablePos + t.table.nodeSize)
  })
}

// prosemirror-tables' move and header commands find the table through the selection
// (not the position they're given): put the cursor in the table's first cell first.
function selectTable(editor, t) {
  const firstCell = t.tableStart + t.map.map[0]
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(firstCell + 1))))
}

export function moveColumn(editor, tablePos, from, to) {
  const t = tableAt(editor.state, tablePos)
  if (!t || from === to) return false
  selectTable(editor, t)
  const ok = moveTableColumn({ from, to, select: false, pos: t.tableStart + 1 })(editor.state, editor.view.dispatch)
  editor.view.focus()
  return ok
}

export function moveRow(editor, tablePos, from, to) {
  const t = tableAt(editor.state, tablePos)
  if (!t || from === to) return false
  selectTable(editor, t)
  const ok = moveTableRow({ from, to, select: false, pos: t.tableStart + 1 })(editor.state, editor.view.dispatch)
  editor.view.focus()
  return ok
}

// Duplicating needs a plain grid: with merged cells the copy has no clear shape.
export function duplicateRow(editor, tablePos, row) {
  return run(editor, tablePos, (tr, t) => {
    if (hasMergedCells(t.table)) return false
    let pos = t.tableStart
    for (let r = 0; r < row; r++) pos += t.table.child(r).nodeSize
    const rowNode = t.table.child(row)
    tr.insert(pos + rowNode.nodeSize, rowNode.copy(rowNode.content))
  })
}

export function duplicateColumn(editor, tablePos, col) {
  return run(editor, tablePos, (tr, t) => {
    if (hasMergedCells(t.table)) return false
    for (const cellPos of cellPositions(t, { col })) {
      const cell = tr.doc.nodeAt(cellPos)
      tr.insert(cellPos + cell.nodeSize, cell.copy(cell.content))
    }
  })
}

export function clearCells(editor, tablePos, which) {
  return run(editor, tablePos, (tr, t) => {
    const paragraph = editor.schema.nodes.paragraph
    for (const cellPos of cellPositions(t, which)) {
      const cell = tr.doc.nodeAt(cellPos)
      tr.replaceWith(cellPos + 1, cellPos + cell.nodeSize - 1, paragraph.create())
    }
  })
}

export function colorCells(editor, tablePos, which, color) {
  return run(editor, tablePos, (tr, t) => {
    for (const cellPos of cellPositions(t, which)) {
      const cell = tr.doc.nodeAt(cellPos)
      tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, background: color })
    }
  })
}

// Header row / column: TipTap's toggles act on the selection too.
export function toggleHeader(editor, tablePos, kind) {
  const t = tableAt(editor.state, tablePos)
  if (!t) return false
  selectTable(editor, t)
  return kind === 'row' ? editor.chain().focus().toggleHeaderRow().run() : editor.chain().focus().toggleHeaderColumn().run()
}

// Whether the table's first row / column is currently a header.
export function headerState(state, tablePos) {
  const t = tableAt(state, tablePos)
  if (!t) return { row: false, col: false }
  const isHeader = (offset) => t.table.nodeAt(offset)?.type.spec.tableRole === 'header_cell'
  const row = Array.from({ length: t.map.width }, (_, c) => t.map.map[c]).every(isHeader)
  const col = Array.from({ length: t.map.height }, (_, r) => t.map.map[r * t.map.width]).every(isHeader)
  return { row, col }
}
