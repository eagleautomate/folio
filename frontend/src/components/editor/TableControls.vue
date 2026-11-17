<template>
  <div v-if="g" data-table-controls class="pointer-events-none absolute inset-0 z-10">
    <!-- what the open menu or a drag acts on -->
    <div v-if="outline" class="absolute rounded-sm ring-2 ring-blue-500" :style="box(outline)" />
    <div v-if="drag.active && drag.line" class="absolute bg-blue-500" :style="box(drag.line)" />

    <!-- table: top-left corner -->
    <button
      class="handle pointer-events-auto absolute flex items-center justify-center rounded-md"
      :class="active === 'table' ? 'is-active' : ''"
      :style="box({ left: g.table.left - 10, top: g.table.top - 10, width: 20, height: 20 })"
      aria-label="Table options"
      title="Table options"
      @pointerdown.prevent="onCornerDown"
    >
      <LucideTable2 class="size-3" />
    </button>

    <!-- column: centred on the top edge of the hovered column -->
    <button
      v-if="g.col"
      class="handle pointer-events-auto absolute flex cursor-grab items-center justify-center rounded-md touch-none"
      :class="active === 'col' ? 'is-active' : ''"
      :style="box({ left: g.col.center - colSize.w / 2, top: g.table.top - colSize.h / 2, width: colSize.w, height: colSize.h })"
      :aria-label="`Column ${cell.col + 1} options (drag to move)`"
      title="Click for options, drag to move"
      @pointerdown.prevent="onHandleDown('col', $event)"
    >
      <LucideGripHorizontal class="size-3.5" />
    </button>

    <!-- row: centred on the left edge of the hovered row -->
    <button
      class="handle pointer-events-auto absolute flex cursor-grab items-center justify-center rounded-md touch-none"
      :class="active === 'row' ? 'is-active' : ''"
      :style="box({ left: g.table.left - colSize.h / 2, top: g.row.center - colSize.w / 2, width: colSize.h, height: colSize.w })"
      :aria-label="`Row ${cell.row + 1} options (drag to move)`"
      title="Click for options, drag to move"
      @pointerdown.prevent="onHandleDown('row', $event)"
    >
      <LucideGripVertical class="size-3.5" />
    </button>

    <!-- add a row / a column at the end -->
    <button
      class="add pointer-events-auto absolute flex items-center justify-center rounded"
      :style="box({ left: g.table.left, top: g.table.bottom + 4, width: g.table.right - g.table.left, height: 16 })"
      aria-label="Add a row"
      title="Add a row"
      @pointerdown.prevent
      @click="act(() => insertRow(editor, cell.tablePos, tableSize().height))"
    >
      <LucidePlus class="size-3" />
    </button>
    <button
      class="add pointer-events-auto absolute flex items-center justify-center rounded"
      :style="box({ left: g.table.right + 4, top: g.table.top, width: 16, height: g.table.bottom - g.table.top })"
      aria-label="Add a column"
      title="Add a column"
      @pointerdown.prevent
      @click="act(() => insertColumn(editor, cell.tablePos, tableSize().width))"
    >
      <LucidePlus class="size-3" />
    </button>

    <TableMenu
      :open="!!active"
      :anchor="menuAnchor"
      :items="menuItems"
      :label="menuLabel"
      @close="closeMenu"
      @color="onColor"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { toast } from 'frappe-ui'
import TableMenu from './TableMenu.vue'
import {
  clearCells,
  colorCells,
  deleteColumn,
  deleteRow,
  deleteTable,
  duplicateColumn,
  duplicateRow,
  hasMergedCells,
  headerState,
  insertColumn,
  insertRow,
  locateCell,
  moveColumn,
  moveRow,
  tableAt,
  toggleHeader,
} from './table'
import IconColor from '~icons/lucide/paint-bucket'
import IconLeft from '~icons/lucide/arrow-left'
import IconRight from '~icons/lucide/arrow-right'
import IconUp from '~icons/lucide/arrow-up'
import IconDown from '~icons/lucide/arrow-down'
import IconMoveLeft from '~icons/lucide/move-left'
import IconMoveRight from '~icons/lucide/move-right'
import IconMoveUp from '~icons/lucide/move-up'
import IconMoveDown from '~icons/lucide/move-down'
import IconDuplicate from '~icons/lucide/copy'
import IconClear from '~icons/lucide/circle-x'
import IconDelete from '~icons/lucide/trash-2'
import IconHeaderRow from '~icons/lucide/panel-top'
import IconHeaderCol from '~icons/lucide/panel-left'
import IconAddRow from '~icons/lucide/rows-3'
import IconAddCol from '~icons/lucide/columns-3'

// Notion-style table handles for the cell under the pointer (or, on a touch screen,
// the cell holding the cursor): a grip on the column's top edge and the row's left
// edge (click: menu, drag: move), a corner button for the whole table, and "+" bars.
const props = defineProps({ editor: { type: Object, required: true } })

const touch = window.matchMedia('(hover: none)').matches
const colSize = touch ? { w: 32, h: 20 } : { w: 26, h: 16 }

const cell = reactive({ tablePos: null, row: 0, col: 0 }) // the hovered cell
const g = shallowRef(null) // geometry, relative to the editor box
const active = ref(null) // open menu: 'col' | 'row' | 'table'
const menuAnchor = ref(null)
const drag = reactive({ kind: null, from: 0, to: 0, active: false, line: null })
let hideTimer = null
let closedAt = { kind: null, at: 0 }

const view = () => props.editor.view
const container = () => view().dom.closest('.folio-editor')
const box = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
const tableSize = () => tableAt(props.editor.state, cell.tablePos)?.map || { width: 0, height: 0 }

// ---- where things are

function cellDom(t, row, col) {
  return view().nodeDOM(t.tableStart + t.map.map[row * t.map.width + col])
}

function measure() {
  const t = cell.tablePos !== null && tableAt(props.editor.state, cell.tablePos)
  const host = container()
  if (!t || !host) return (g.value = null)
  cell.row = Math.min(cell.row, t.map.height - 1)
  cell.col = Math.min(cell.col, t.map.width - 1)
  const tableEl = cellDom(t, 0, 0)?.closest('table')
  if (!tableEl) return (g.value = null)
  const base = host.getBoundingClientRect()
  const tr = tableEl.getBoundingClientRect()
  const vis = (tableEl.closest('.tableWrapper') || tableEl).getBoundingClientRect() // a wide table scrolls
  const table = {
    left: Math.max(tr.left, vis.left) - base.left,
    right: Math.min(tr.right, vis.right) - base.left,
    top: tr.top - base.top,
    bottom: tr.bottom - base.top,
  }
  const cr = cellDom(t, 0, cell.col)?.getBoundingClientRect()
  const rr = cellDom(t, cell.row, 0)?.getBoundingClientRect()
  const colCenter = cr && cr.left + cr.width / 2 - base.left
  g.value = {
    table,
    // a column scrolled out of view gets no handle
    col: cr && colCenter >= table.left && colCenter <= table.right ? { center: colCenter, left: cr.left - base.left, right: cr.right - base.left } : null,
    row: rr ? { center: rr.top + rr.height / 2 - base.top, top: rr.top - base.top, bottom: rr.bottom - base.top } : { center: table.top, top: table.top, bottom: table.top },
  }
}

// edges of every column (row 0) or row (column 0), for dropping a dragged one
function slots(kind) {
  const t = tableAt(props.editor.state, cell.tablePos)
  const n = kind === 'col' ? t.map.width : t.map.height
  return Array.from({ length: n }, (_, i) => (kind === 'col' ? cellDom(t, 0, i) : cellDom(t, i, 0)).getBoundingClientRect())
}

// the block drag handle would sit on the corner button: the corner covers what it did
watch(g, (v) => container()?.toggleAttribute('data-table-hover', !!v))

const outline = computed(() => {
  if (!g.value) return null
  const { table, col, row } = g.value
  const kind = drag.active ? drag.kind : active.value
  if (kind === 'col' && col) return { left: col.left, top: table.top, width: col.right - col.left, height: table.bottom - table.top }
  if (kind === 'row') return { left: table.left, top: row.top, width: table.right - table.left, height: row.bottom - row.top }
  if (kind === 'table') return { left: table.left, top: table.top, width: table.right - table.left, height: table.bottom - table.top }
  return null
})

// ---- following the pointer (or the cursor on touch screens)

function show(cellEl) {
  const at = locateCell(view(), cellEl)
  if (!at) return
  clearTimeout(hideTimer)
  Object.assign(cell, at)
  measure()
}

function hideSoon() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (active.value || drag.kind) return
    cell.tablePos = null
    g.value = null
  }, 250)
}

// on the document: this component mounts before the editor is in the page, and the
// pointer leaving the editor must hide the handles too
function onPointerMove(e) {
  if (touch || active.value || drag.kind) return
  const host = container()
  if (host && e.target.closest?.('[data-table-controls]') && host.contains(e.target)) return clearTimeout(hideTimer)
  const cellEl = e.target.closest?.('td, th')
  if (cellEl && view().dom.contains(cellEl)) show(cellEl)
  else if (g.value) hideSoon()
}

function onSelection() {
  if (!touch || active.value) return
  const { from } = props.editor.state.selection
  let node = view().domAtPos(from).node
  if (node.nodeType !== 1) node = node.parentElement
  const cellEl = node?.closest?.('td, th')
  if (cellEl && view().dom.contains(cellEl)) show(cellEl)
  else {
    cell.tablePos = null
    g.value = null
  }
}

function onTransaction({ transaction }) {
  if (cell.tablePos !== null && transaction.docChanged) cell.tablePos = transaction.mapping.map(cell.tablePos)
  requestAnimationFrame(measure)
}
const onReflow = () => g.value && measure()

onMounted(() => {
  document.addEventListener('pointermove', onPointerMove)
  window.addEventListener('scroll', onReflow, true)
  window.addEventListener('resize', onReflow)
  props.editor.on('transaction', onTransaction)
  props.editor.on('selectionUpdate', onSelection)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('scroll', onReflow, true)
  window.removeEventListener('resize', onReflow)
  props.editor.off('transaction', onTransaction)
  props.editor.off('selectionUpdate', onSelection)
  endDrag()
})

// ---- handles: click opens the menu, drag moves the row / column

function openMenu(kind, el) {
  if (closedAt.kind === kind && Date.now() - closedAt.at < 300) return // the click that closed it
  menuAnchor.value = el.getBoundingClientRect()
  active.value = kind
}

function closeMenu() {
  closedAt = { kind: active.value, at: Date.now() }
  active.value = null
}

function onCornerDown(e) {
  openMenu('table', e.currentTarget)
}

function onHandleDown(kind, e) {
  const el = e.currentTarget
  Object.assign(drag, { kind, from: kind === 'col' ? cell.col : cell.row, to: null, active: false, line: null, x: e.clientX, y: e.clientY, el })
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', endDrag)
}

function onDragMove(e) {
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return
    if (drag.kind === 'col' && !g.value?.col) return
    drag.active = true
    document.body.style.userSelect = 'none'
  }
  const base = container().getBoundingClientRect()
  const rects = slots(drag.kind)
  const isCol = drag.kind === 'col'
  const p = isCol ? e.clientX : e.clientY
  // the gap the pointer is nearest: 0 = before the first, n = after the last
  const gap = rects.filter((r) => (isCol ? r.left + r.width / 2 : r.top + r.height / 2) < p).length
  drag.to = gap > drag.from ? gap - 1 : gap
  const { table } = g.value
  if (isCol) {
    const x = (gap === rects.length ? rects[gap - 1].right : rects[gap].left) - base.left
    drag.line = { left: x - 1.5, top: table.top, width: 3, height: table.bottom - table.top }
  } else {
    const y = (gap === rects.length ? rects[gap - 1].bottom : rects[gap].top) - base.top
    drag.line = { left: table.left, top: y - 1.5, width: table.right - table.left, height: 3 }
  }
}

function onDragEnd() {
  const { kind, from, to, el } = drag
  const moved = drag.active
  endDrag()
  if (!moved) return openMenu(kind, el)
  if (to === null || to === from) return
  const ok = kind === 'col' ? moveColumn(props.editor, cell.tablePos, from, to) : moveRow(props.editor, cell.tablePos, from, to)
  if (ok) cell[kind === 'col' ? 'col' : 'row'] = to
}

function endDrag() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', endDrag)
  document.body.style.userSelect = ''
  Object.assign(drag, { kind: null, active: false, line: null, el: null })
}

// ---- menus

function act(fn, failure) {
  const ok = fn()
  if (!ok && failure) toast.error(failure)
  return ok
}

const MERGED = "This doesn't work on tables with merged cells"

const menuLabel = computed(() => ({ col: `Column ${cell.col + 1}`, row: `Row ${cell.row + 1}`, table: 'Table' })[active.value] || 'Table actions')

const menuItems = computed(() => {
  if (!active.value || cell.tablePos === null) return []
  const ed = props.editor
  const at = cell.tablePos
  const size = tableSize()
  const t = tableAt(ed.state, at)
  const merged = t ? hasMergedCells(t.table) : false
  const header = headerState(ed.state, at)
  const { row, col } = cell
  if (active.value === 'col')
    return [
      { label: 'Color', icon: IconColor, colors: true },
      { label: 'Insert left', icon: IconLeft, run: () => act(() => insertColumn(ed, at, col)) },
      { label: 'Insert right', icon: IconRight, run: () => act(() => insertColumn(ed, at, col + 1)) },
      { label: 'Move left', icon: IconMoveLeft, disabled: col === 0, run: () => act(() => moveColumn(ed, at, col, col - 1)) && (cell.col = col - 1) },
      { label: 'Move right', icon: IconMoveRight, disabled: col >= size.width - 1, run: () => act(() => moveColumn(ed, at, col, col + 1)) && (cell.col = col + 1) },
      { label: 'Duplicate', icon: IconDuplicate, disabled: merged, run: () => act(() => duplicateColumn(ed, at, col), MERGED) },
      { label: 'Clear contents', icon: IconClear, run: () => act(() => clearCells(ed, at, { col })) },
      col === 0 && { label: 'Header column', icon: IconHeaderCol, checked: header.col, run: () => act(() => toggleHeader(ed, at, 'col')) },
      { label: 'Delete column', icon: IconDelete, danger: true, run: () => act(() => deleteColumn(ed, at, col)) },
    ].filter(Boolean)
  if (active.value === 'row')
    return [
      { label: 'Color', icon: IconColor, colors: true },
      { label: 'Insert above', icon: IconUp, run: () => act(() => insertRow(ed, at, row)) },
      { label: 'Insert below', icon: IconDown, run: () => act(() => insertRow(ed, at, row + 1)) },
      { label: 'Move up', icon: IconMoveUp, disabled: row === 0, run: () => act(() => moveRow(ed, at, row, row - 1)) && (cell.row = row - 1) },
      { label: 'Move down', icon: IconMoveDown, disabled: row >= size.height - 1, run: () => act(() => moveRow(ed, at, row, row + 1)) && (cell.row = row + 1) },
      { label: 'Duplicate', icon: IconDuplicate, disabled: merged, run: () => act(() => duplicateRow(ed, at, row), MERGED) },
      { label: 'Clear contents', icon: IconClear, run: () => act(() => clearCells(ed, at, { row })) },
      row === 0 && { label: 'Header row', icon: IconHeaderRow, checked: header.row, run: () => act(() => toggleHeader(ed, at, 'row')) },
      { label: 'Delete row', icon: IconDelete, danger: true, run: () => act(() => deleteRow(ed, at, row)) },
    ].filter(Boolean)
  return [
    { label: 'Color', icon: IconColor, colors: true },
    { label: 'Header row', icon: IconHeaderRow, checked: header.row, run: () => act(() => toggleHeader(ed, at, 'row')) },
    { label: 'Header column', icon: IconHeaderCol, checked: header.col, run: () => act(() => toggleHeader(ed, at, 'col')) },
    { label: 'Add row', icon: IconAddRow, run: () => act(() => insertRow(ed, at, size.height)) },
    { label: 'Add column', icon: IconAddCol, run: () => act(() => insertColumn(ed, at, size.width)) },
    { label: 'Clear contents', icon: IconClear, run: () => act(() => clearCells(ed, at, {})) },
    { label: 'Delete table', icon: IconDelete, danger: true, run: () => act(() => deleteTable(ed, at)) },
  ]
})

function onColor(color) {
  const which = { col: { col: cell.col }, row: { row: cell.row }, table: {} }[closedAt.kind]
  act(() => colorCells(props.editor, cell.tablePos, which, color))
}
</script>

<style scoped>
.handle {
  @apply border border-outline-gray-2 bg-surface-base text-ink-gray-5 shadow-sm transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-2 hover:text-ink-gray-7;
}
.handle.is-active {
  @apply border-blue-500 bg-blue-500 text-white hover:bg-blue-500 hover:text-white;
}
.add {
  @apply text-ink-gray-4 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-7;
}
</style>
