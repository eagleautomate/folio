<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      role="menu"
      :aria-label="label"
      tabindex="-1"
      class="fixed z-[100] w-60 rounded-xl border border-outline-gray-2 bg-surface-elevation-2 p-1.5 shadow-xl outline-none"
      :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
      @keydown="onKeydown"
      @pointerdown.stop
    >
      <template v-if="view === 'main'">
        <input
          ref="search"
          v-model="query"
          class="mb-1 h-8 w-full rounded-md border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-8 placeholder-ink-gray-4 focus:border-outline-gray-4 focus:ring-0"
          placeholder="Search actions…"
          aria-label="Search actions"
        />
        <button
          v-for="(item, i) in filtered"
          :key="item.label"
          role="menuitem"
          :disabled="item.disabled"
          class="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm disabled:opacity-40"
          :class="[i === active ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2', item.danger ? 'text-ink-red-6' : 'text-ink-gray-8']"
          @mouseenter="active = i"
          @click="choose(item)"
        >
          <component :is="item.icon" class="size-4 shrink-0" :class="item.danger ? '' : 'text-ink-gray-6'" />
          <span class="flex-1">{{ item.label }}</span>
          <LucideCheck v-if="item.checked" class="size-4 text-ink-gray-7" />
          <LucideChevronRight v-if="item.colors" class="size-4 text-ink-gray-5" />
        </button>
        <p v-if="!filtered.length" class="px-2 py-2 text-sm text-ink-gray-5">No matching action</p>
      </template>

      <template v-else>
        <button class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-ink-gray-6 hover:bg-surface-gray-2" @click="view = 'main'">
          <LucideChevronLeft class="size-4" /> Background color
        </button>
        <button
          v-for="(c, i) in colors"
          :key="c.label"
          role="menuitem"
          class="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-ink-gray-8"
          :class="i === active ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
          @mouseenter="active = i"
          @click="chooseColor(c)"
        >
          <span class="size-4 shrink-0 rounded border border-outline-gray-3" :style="{ background: c.swatch }" />
          <span class="flex-1">{{ c.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { CELL_COLORS } from './table'

// A small action menu for the table handles: search, keyboard navigation, and a
// colour list. `anchor` is the handle's screen rect; the menu opens beside it.
const props = defineProps({
  open: { type: Boolean, default: false },
  anchor: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Table actions' },
})
const emit = defineEmits(['close', 'color'])

const panel = ref(null)
const search = ref(null)
const query = ref('')
const active = ref(0)
const view = ref('main')
const pos = ref({ x: 0, y: 0 })
const colors = CELL_COLORS
const touch = window.matchMedia('(hover: none)').matches

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.items.filter((i) => i.label.toLowerCase().includes(q)) : props.items
})
watch(query, () => (active.value = 0))

watch(
  () => props.open,
  async (open) => {
    if (!open) return removeListeners()
    query.value = ''
    view.value = 'main'
    active.value = 0
    await nextTick()
    place()
    // a phone keyboard would cover the menu: focus the panel, not the search box
    ;(touch ? panel.value : search.value)?.focus()
    setTimeout(() => {
      document.addEventListener('pointerdown', onOutside, true)
      window.addEventListener('scroll', onScroll, true)
    })
  },
)

function place() {
  const a = props.anchor
  const el = panel.value
  if (!a || !el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const gap = 6
  let x = a.left
  let y = a.bottom + gap
  if (y + h > window.innerHeight - 8) y = Math.max(8, a.top - h - gap)
  x = Math.min(Math.max(8, x), window.innerWidth - w - 8)
  pos.value = { x, y }
}

function choose(item) {
  if (item.disabled) return
  if (item.colors) {
    view.value = 'color'
    active.value = 0
    nextTick(() => panel.value?.focus())
    return
  }
  emit('close')
  item.run()
}

function chooseColor(c) {
  emit('close')
  emit('color', c.name)
}

function onKeydown(e) {
  const list = view.value === 'main' ? filtered.value : colors
  if (e.key === 'ArrowDown') {
    active.value = (active.value + 1) % Math.max(list.length, 1)
  } else if (e.key === 'ArrowUp') {
    active.value = (active.value - 1 + list.length) % Math.max(list.length, 1)
  } else if (e.key === 'Enter') {
    const item = list[active.value]
    if (item) view.value === 'main' ? choose(item) : chooseColor(item)
  } else if (e.key === 'Escape') {
    if (view.value === 'color') view.value = 'main'
    else emit('close')
  } else return
  e.preventDefault()
  e.stopPropagation()
}

function onOutside(e) {
  if (!panel.value?.contains(e.target)) emit('close')
}
function onScroll(e) {
  if (!panel.value?.contains(e.target)) emit('close')
}
function removeListeners() {
  document.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('scroll', onScroll, true)
}
onBeforeUnmount(removeListeners)
</script>
