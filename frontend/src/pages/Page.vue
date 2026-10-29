<template>
  <div class="flex h-full flex-col">
    <!-- top bar -->
    <header class="flex h-11 shrink-0 items-center gap-2 px-3">
      <nav class="flex min-w-0 flex-1 items-center gap-0.5 text-base text-ink-gray-6">
        <template v-for="(crumb, i) in breadcrumbs" :key="crumb.name">
          <span v-if="i" class="text-ink-gray-4">/</span>
          <component
            :is="crumb.space ? 'span' : 'router-link'"
            :to="crumb.space ? undefined : { name: 'Page', params: { name: crumb.name } }"
            class="flex min-w-0 items-center gap-1 truncate rounded px-1.5 py-0.5"
            :class="crumb.space ? 'text-ink-gray-5' : 'hover:bg-surface-gray-2'"
          >
            <span v-if="crumb.icon" class="text-sm">{{ crumb.icon }}</span>
            <span class="truncate">{{ crumb.title || 'Untitled' }}</span>
          </component>
        </template>
      </nav>

      <span class="hidden shrink-0 text-sm text-ink-gray-5 sm:block">{{ statusText }}</span>
      <Button
        variant="ghost"
        icon="lucide-star"
        :class="{ 'text-amber-500 [&_svg]:fill-amber-400': isFavorite }"
        :aria-label="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click="onToggleFavorite"
      />
      <Dropdown :options="pageMenu" align="end">
        <template #trigger="{ open }">
          <Button variant="ghost" icon="lucide-more-horizontal" :active="open" aria-label="Page actions" />
        </template>
      </Dropdown>
    </header>

    <div v-if="page.error" class="m-auto max-w-sm text-center">
      <p class="text-lg font-medium text-ink-gray-8">This page isn't available</p>
      <p class="mt-1 text-base text-ink-gray-5">It may have been deleted, or you don't have access.</p>
      <Button class="mt-4" label="Go home" @click="$router.push({ name: 'Home' })" />
    </div>

    <LoadingIndicator v-else-if="!doc" class="m-auto size-6 text-ink-gray-5" />

    <div v-else ref="scroller" class="flex-1 overflow-y-auto">
      <div
        v-if="doc.is_archived"
        class="flex items-center justify-center gap-3 bg-red-50 px-4 py-2 text-base text-red-700"
      >
        This page is in the trash.
        <Button size="sm" label="Restore page" @click="restore" />
      </div>
      <div
        v-else-if="doc.is_locked"
        class="flex items-center justify-center gap-2 bg-surface-gray-1 px-4 py-1.5 text-sm text-ink-gray-6"
      >
        <LucideLock class="size-3.5" /> Locked for editing.
        <button v-if="canEditAccess" class="underline" @click="setMeta({ is_locked: 0 })">Unlock</button>
      </div>

      <!-- cover -->
      <div v-if="doc.cover" class="group relative h-[28vh] max-h-72 min-h-36 w-full" :style="coverStyle">
        <div v-if="doc.can_edit" class="absolute bottom-3 right-4 hidden gap-1 group-hover:flex">
          <Button size="sm" label="Change cover" @click="cycleCover" />
          <Button size="sm" label="Remove" @click="setMeta({ cover: null })" />
        </div>
      </div>

      <div class="mx-auto px-6 sm:px-12" :class="doc.full_width ? 'max-w-none' : 'max-w-[720px]'">
        <!-- icon + title -->
        <div class="group relative" :class="doc.cover ? (doc.icon ? '-mt-10' : 'pt-8') : 'pt-16'">
          <EmojiPicker v-if="doc.icon" v-model="doc.icon" removable @select="(e) => setMeta({ icon: e })">
            <button class="mb-2 block rounded text-[64px] leading-none hover:bg-surface-gray-2" :disabled="!doc.can_edit">
              {{ doc.icon }}
            </button>
          </EmojiPicker>

          <div v-if="doc.can_edit" class="flex h-7 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <EmojiPicker v-if="!doc.icon" @select="(e) => setMeta({ icon: e })">
              <button class="flex items-center gap-1 rounded px-1.5 py-1 text-sm text-ink-gray-5 hover:bg-surface-gray-2">
                <LucideSmile class="size-4" /> Add icon
              </button>
            </EmojiPicker>
            <button
              v-if="!doc.cover"
              class="flex items-center gap-1 rounded px-1.5 py-1 text-sm text-ink-gray-5 hover:bg-surface-gray-2"
              @click="cycleCover"
            >
              <LucideImage class="size-4" /> Add cover
            </button>
          </div>

          <textarea
            ref="titleInput"
            v-model="title"
            rows="1"
            class="mt-1 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[2.5rem] font-bold leading-tight text-ink-gray-9 placeholder-ink-gray-3 focus:ring-0"
            placeholder="Untitled"
            :readonly="!doc.can_edit"
            @input="onTitleInput"
            @keydown.enter.prevent="editorRef?.focus('start')"
          />
        </div>

        <!-- project pages wrap the editor (their Overview) in a live header + tabs -->
        <component
          :is="isProjectPage ? ProjectPage : 'div'"
          v-bind="isProjectPage ? { projectName: doc.project, pageName: name, editable: doc.can_edit } : {}"
        >
          <Editor
            ref="editorRef"
            class="mt-3"
            :page-name="name"
            :project-page="isProjectPage ? doc.project : null"
            :content="doc.content"
            :editable="doc.can_edit"
            @update="onContentUpdate"
            @create-sub-page="createSubPage"
          />
        </component>
      </div>
    </div>

    <VersionHistory v-if="doc" v-model="historyOpen" :page="name" @restored="onRestored" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router'
import { Button, Dropdown, LoadingIndicator, call, createResource, toast } from 'frappe-ui'
import Editor from '@/components/editor/Editor.vue'
import ProjectPage from '@/components/project/ProjectPage.vue'
import EmojiPicker from '@/components/EmojiPicker.vue'
import VersionHistory from '@/components/VersionHistory.vue'
import {
  state,
  patchPage,
  createPage,
  archivePage,
  toggleFavorite,
  expandAncestors,
  loadWorkspace,
} from '@/data/workspace'
import { COVERS, debounce, timeAgo } from '@/utils'

const props = defineProps({ name: { type: String, required: true } })
const router = useRouter()

const doc = ref(null)
const title = ref('')
const titleInput = ref(null)
const editorRef = ref(null)
const historyOpen = ref(false)
const saveState = ref('saved') // 'saved' | 'dirty' | 'saving' | 'error'
const now = ref(Date.now())

let pendingContent = null
let pendingTitle = null
let saving = null

const page = createResource({
  url: 'folio.api.pages.get_page',
  params: { name: props.name },
  auto: true,
  onSuccess(data) {
    doc.value = data
    title.value = data.title || ''
    document.title = `${data.title || 'Untitled'} · Folio`
    expandAncestors(props.name)
    nextTick(autosizeTitle)
    if (!data.title && data.can_edit) nextTick(() => titleInput.value?.focus())
  },
})

const breadcrumbs = computed(() => [
  ...(doc.value?.breadcrumbs || []),
  ...(doc.value ? [{ name: props.name, title: title.value, icon: doc.value.icon }] : []),
])
const isProjectPage = computed(() => !!(doc.value?.is_project_page && doc.value?.project))
const isFavorite = computed(() => state.favorites.includes(props.name))
const canEditAccess = computed(() => ['edit', 'full'].includes(doc.value?.access))
const coverStyle = computed(() => {
  const cover = doc.value?.cover || ''
  return cover.startsWith('linear-gradient') || cover.startsWith('#')
    ? { background: cover }
    : { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
})

const statusText = computed(() => {
  now.value // re-evaluate on the clock tick
  if (saveState.value === 'saving' || saveState.value === 'dirty') return 'Saving…'
  if (saveState.value === 'error') return 'Not saved'
  if (!doc.value?.last_edited_on) return ''
  return `Edited ${timeAgo(doc.value.last_edited_on)}`
})

const pageMenu = computed(() => {
  if (!doc.value) return []
  const d = doc.value
  return [
    {
      group: 'Page',
      options: [
        {
          label: d.full_width ? 'Default width' : 'Full width',
          icon: 'lucide-move-horizontal',
          condition: () => d.can_edit,
          onClick: () => setMeta({ full_width: d.full_width ? 0 : 1 }),
        },
        {
          label: d.is_locked ? 'Unlock page' : 'Lock page',
          icon: d.is_locked ? 'lucide-lock-open' : 'lucide-lock',
          condition: () => canEditAccess.value && !d.is_archived,
          onClick: () => setMeta({ is_locked: d.is_locked ? 0 : 1 }),
        },
        { label: 'Version history', icon: 'lucide-history', onClick: () => (historyOpen.value = true) },
        {
          label: 'Copy link',
          icon: 'lucide-link',
          onClick: () => {
            navigator.clipboard?.writeText(window.location.href)
            toast.success('Link copied')
          },
        },
        {
          label: 'Open in Desk',
          icon: 'lucide-external-link',
          onClick: () => window.open(`/desk/folio-page/${props.name}`, '_blank'),
        },
      ].filter((o) => !o.condition || o.condition()),
    },
    {
      group: 'Danger',
      options: [
        {
          label: 'Move to trash',
          icon: 'lucide-trash-2',
          theme: 'red',
          condition: () => canEditAccess.value && !d.is_archived,
          onClick: async () => {
            await flushSave()
            await archivePage(props.name)
            toast.success('Moved to trash')
            router.push({ name: 'Home' })
          },
        },
      ].filter((o) => !o.condition || o.condition()),
    },
  ].filter((g) => g.options.length)
})

// ---- saving

const scheduleSave = debounce(() => save(), 700)

function onContentUpdate(json) {
  pendingContent = json
  saveState.value = 'dirty'
  scheduleSave()
}

function onTitleInput() {
  autosizeTitle()
  pendingTitle = title.value
  patchPage(props.name, { title: title.value })
  document.title = `${title.value || 'Untitled'} · Folio`
  saveState.value = 'dirty'
  scheduleSave()
}

async function save() {
  if (saving) {
    // a save is in flight; run again once it finishes
    await saving
    if (pendingContent === null && pendingTitle === null) return
  }
  if (pendingContent === null && pendingTitle === null) return
  const content = pendingContent ?? editorRef.value?.editor?.getJSON()
  const nextTitle = pendingTitle
  pendingContent = null
  pendingTitle = null
  saveState.value = 'saving'

  saving = call('folio.api.pages.save_content', {
    name: props.name,
    content: JSON.stringify(content),
    base_version: doc.value.content_version,
    title: nextTitle,
  })
  try {
    const result = await saving
    if (result.conflict) {
      doc.value.content_version = result.content_version
      editorRef.value?.setContent(result.content)
      toast.warning('This page was changed by someone else', {
        description: 'Loaded the latest version. Your last few keystrokes were not saved.',
      })
    } else {
      Object.assign(doc.value, {
        content_version: result.content_version,
        last_edited_on: result.last_edited_on,
        last_edited_by: result.last_edited_by,
      })
    }
    saveState.value = pendingContent || pendingTitle !== null ? 'dirty' : 'saved'
  } catch (e) {
    saveState.value = 'error'
    toast.error(e?.messages?.[0] || 'Could not save the page')
  } finally {
    saving = null
  }
}

async function flushSave() {
  scheduleSave.cancel()
  await save()
}

async function setMeta(fields) {
  Object.assign(doc.value, fields)
  if ('icon' in fields) patchPage(props.name, { icon: fields.icon })
  const updated = await call('folio.api.pages.update_page', { name: props.name, ...fields })
  if ('is_locked' in fields) {
    doc.value.can_edit = canEditAccess.value && !updated.is_locked && !updated.is_archived
  }
}

function cycleCover() {
  const i = COVERS.indexOf(doc.value.cover)
  setMeta({ cover: COVERS[(i + 1) % COVERS.length] })
}

function autosizeTitle() {
  const el = titleInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

async function createSubPage() {
  const child = await createPage(doc.value.space, props.name)
  editorRef.value?.insertPageLink(child)
  await flushSave()
  router.push({ name: 'Page', params: { name: child.name } })
}

async function onToggleFavorite() {
  const fav = await toggleFavorite(props.name)
  toast.success(fav ? 'Added to favorites' : 'Removed from favorites')
}

async function restore() {
  await call('folio.api.pages.restore_page', { name: props.name })
  await loadWorkspace()
  page.reload()
}

function onRestored(data) {
  doc.value = data
  title.value = data.title || ''
  editorRef.value?.setContent(data.content)
  patchPage(props.name, { title: data.title })
}

// ---- lifecycle

function onBeforeUnload(e) {
  if (saveState.value === 'dirty' || saveState.value === 'saving') {
    save()
    e.preventDefault()
  }
}

let clock
onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  clock = setInterval(() => (now.value = Date.now()), 30000)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  clearInterval(clock)
})
// leaving to another route, or to another page (same route, new params)
onBeforeRouteLeave(flushSave)
onBeforeRouteUpdate(flushSave)

watch(
  () => doc.value?.title,
  () => nextTick(autosizeTitle),
)
</script>
