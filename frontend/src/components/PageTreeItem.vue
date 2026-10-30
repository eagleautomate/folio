<template>
  <div>
    <div
      class="group relative flex h-7 cursor-pointer items-center gap-1 rounded pr-1 text-base text-ink-gray-7 hover:bg-surface-gray-2"
      :class="{
        '!bg-surface-gray-3 font-medium text-ink-gray-9': isActive,
        'opacity-40': drag.page === page.name,
        'ring-1 ring-inset ring-outline-gray-4 bg-surface-gray-2': dropHere === 'inside',
      }"
      :style="{ paddingLeft: `${depth * 14 + 4}px` }"
      draggable="true"
      @click="open"
      @dragstart="onDragStart"
      @dragend="resetDrag"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div v-if="dropHere === 'before'" class="pointer-events-none absolute inset-x-1 top-0 h-0.5 rounded bg-blue-500" />
      <div v-if="dropHere === 'after'" class="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded bg-blue-500" />

      <button
        class="flex size-5 shrink-0 items-center justify-center rounded text-ink-gray-5 hover:bg-surface-gray-4"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        @click.stop="setExpanded(page.name, !expanded)"
      >
        <!-- page icon by default, expand chevron on hover (like Notion) -->
        <span class="group-hover:hidden">
          <span v-if="page.icon" class="text-sm leading-none">{{ page.icon }}</span>
          <LucideFileText v-else class="size-4" :class="{ 'text-ink-gray-7': hasKids }" />
        </span>
        <LucideChevronRight
          class="hidden size-3.5 transition-transform group-hover:block"
          :class="{ 'rotate-90': expanded }"
        />
      </button>

      <span class="min-w-0 flex-1 truncate">{{ pageTitle(page) }}</span>

      <!-- stays visible while the menu is open: the menu is anchored to this button -->
      <div class="items-center" :class="menuOpen ? 'flex' : 'hidden group-hover:flex'" @click.stop>
        <Dropdown v-model:open="menuOpen" :options="menu" align="start">
          <template #trigger>
            <button class="flex size-5 items-center justify-center rounded text-ink-gray-5 hover:bg-surface-gray-4" aria-label="Page actions">
              <LucideMoreHorizontal class="size-3.5" />
            </button>
          </template>
        </Dropdown>
        <button
          v-if="canEdit"
          class="flex size-5 items-center justify-center rounded text-ink-gray-5 hover:bg-surface-gray-4"
          aria-label="Add a page inside"
          @click="addChild"
        >
          <LucidePlus class="size-3.5" />
        </button>
      </div>
    </div>

    <template v-if="expanded">
      <PageTreeItem v-for="child in children" :key="child.name" :page="child" :depth="depth + 1" />
      <div
        v-if="!children.length"
        class="flex h-7 items-center text-sm text-ink-gray-4"
        :style="{ paddingLeft: `${(depth + 1) * 14 + 28}px` }"
      >
        No pages inside
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dropdown, toast } from 'frappe-ui'
import {
  state,
  childrenOf,
  hasChildren,
  isExpanded,
  setExpanded,
  createPage,
  movePage,
  archivePage,
  duplicatePage,
  toggleFavorite,
  canEditSpace,
  pagesByName,
} from '@/data/workspace'
import { drag, dropPosition, resetDrag } from '@/composables/dragTree'
import { pageTitle } from '@/utils'

defineOptions({ name: 'PageTreeItem' })

const props = defineProps({
  page: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})

const route = useRoute()
const menuOpen = ref(false)
const router = useRouter()

const children = computed(() => childrenOf(props.page.space, props.page.name))
const hasKids = computed(() => hasChildren(props.page.name))
const expanded = computed(() => isExpanded(props.page.name))
const isActive = computed(() => route.params.name === props.page.name)
// a page can be more restricted than its space (read-only ERPNext project)
const canEdit = computed(() => (props.page.access ? ['edit', 'full'].includes(props.page.access) : canEditSpace(props.page.space)))
const isFavorite = computed(() => state.favorites.includes(props.page.name))
const dropHere = computed(() => (drag.over === props.page.name ? drag.position : null))

// spaces you can add pages to, other than this page's own (Duplicate covers that)
const copyTargets = computed(() => state.spaces.filter((s) => s.name !== props.page.space && canEditSpace(s.name)))

const menu = computed(() => [
  {
    label: isFavorite.value ? 'Remove from favorites' : 'Add to favorites',
    icon: isFavorite.value ? 'lucide-star-off' : 'lucide-star',
    onClick: () => toggleFavorite(props.page.name),
  },
  canEdit.value && {
    label: 'Duplicate',
    icon: 'lucide-copy',
    onClick: async () => {
      const copy = await duplicatePage(props.page.name)
      router.push({ name: 'Page', params: { name: copy.name } })
    },
  },
  copyTargets.value.length && {
    label: 'Copy to…',
    icon: 'lucide-copy-plus',
    submenu: copyTargets.value.map((space) => ({
      label: `${space.icon ? space.icon + ' ' : ''}${space.title}`,
      onClick: async () => {
        const copy = await duplicatePage(props.page.name, space.name)
        toast.success(`Copied to ${space.title}`)
        router.push({ name: 'Page', params: { name: copy.name } })
      },
    })),
  },
  {
    label: 'Copy link',
    icon: 'lucide-link',
    onClick: () => {
      navigator.clipboard?.writeText(`${location.origin}/folio/p/${props.page.name}`)
      toast.success('Link copied')
    },
  },
  canEdit.value && {
    label: 'Move to trash',
    icon: 'lucide-trash-2',
    theme: 'red',
    onClick: async () => {
      await archivePage(props.page.name)
      toast.success('Moved to trash')
      if (isActive.value) router.push({ name: 'Home' })
    },
  },
].filter(Boolean))

function open() {
  router.push({ name: 'Page', params: { name: props.page.name } })
}

async function addChild() {
  const page = await createPage(props.page.space, props.page.name)
  router.push({ name: 'Page', params: { name: page.name } })
}

// ---- drag and drop

function isInside(target, dragged) {
  // true when `target` is `dragged` or one of its descendants
  let node = pagesByName.value[target]
  while (node) {
    if (node.name === dragged) return true
    node = pagesByName.value[node.parent_page]
  }
  return false
}

function onDragStart(e) {
  drag.page = props.page.name
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', props.page.name)
}

function onDragOver(e) {
  if (!drag.page || isInside(props.page.name, drag.page) || !canEdit.value) {
    e.dataTransfer.dropEffect = 'none'
    return
  }
  drag.over = props.page.name
  drag.position = dropPosition(e, e.currentTarget)
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget) && drag.over === props.page.name) {
    drag.over = null
  }
}

async function onDrop() {
  const dragged = drag.page
  const position = drag.position
  resetDrag()
  if (!dragged || !position || isInside(props.page.name, dragged)) return

  const target = props.page
  try {
    if (position === 'inside') {
      const count = childrenOf(target.space, target.name).filter((p) => p.name !== dragged).length
      await movePage(dragged, target.space, target.name, count)
      setExpanded(target.name, true)
    } else {
      const siblings = childrenOf(target.space, target.parent_page || null).filter((p) => p.name !== dragged)
      const index = siblings.findIndex((p) => p.name === target.name) + (position === 'after' ? 1 : 0)
      await movePage(dragged, target.space, target.parent_page || null, index)
    }
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not move the page')
  }
}
</script>
