<template>
  <Dialog v-model="open" :options="{ size: 'xl' }" @after-leave="reset">
    <template #body>
      <div class="flex max-h-[80vh] flex-col">
        <header class="flex items-center gap-3 px-6 pt-5">
          <span class="text-2xl">{{ space?.icon || '📁' }}</span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-semibold text-ink-gray-9">{{ space?.title || 'Space' }} settings</h2>
            <p v-if="space && !space.can_manage" class="text-sm text-ink-gray-5">Only members with Full Access can change these settings.</p>
          </div>
          <Button variant="ghost" icon="lucide-x" aria-label="Close" @click="open = false" />
        </header>

        <nav class="mt-4 flex gap-5 border-b border-outline-gray-1 px-6" role="tablist">
          <button
            v-for="t in TABS"
            :key="t"
            role="tab"
            :aria-selected="tab === t"
            class="-mb-px border-b-2 pb-2 text-base"
            :class="tab === t ? 'border-outline-gray-5 font-medium text-ink-gray-9' : 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'"
            @click="tab = t"
          >
            {{ t }}<span v-if="t === 'Members' && space" class="ml-1.5 rounded bg-surface-gray-2 px-1.5 text-xs text-ink-gray-6">{{ space.members.length }}</span>
          </button>
        </nav>

        <div v-if="!space" class="flex justify-center p-10"><LoadingIndicator class="size-5 text-ink-gray-5" /></div>

        <!-- General -->
        <div v-else-if="tab === 'General'" class="flex-1 overflow-y-auto px-6 py-5">
          <fieldset :disabled="!space.can_manage || saving" class="flex flex-col gap-5">
            <div class="flex items-end gap-2">
              <EmojiPicker :model-value="form.icon" @select="(e) => (form.icon = e || '📁')">
                <button type="button" class="flex size-8 items-center justify-center rounded border border-outline-gray-2 text-lg hover:bg-surface-gray-2" aria-label="Space icon">
                  {{ form.icon || '📁' }}
                </button>
              </EmojiPicker>
              <FormControl v-model="form.title" class="flex-1" label="Name" />
            </div>
            <FormControl v-model="form.description" type="textarea" label="Description" placeholder="What is this space for?" />

            <div>
              <div class="mb-2 text-xs text-ink-gray-5">Who can see it</div>
              <label v-for="v in VISIBILITY" :key="v.value" class="mb-2 flex cursor-pointer items-start gap-2.5 rounded-md border p-3" :class="form.visibility === v.value ? 'border-outline-gray-4 bg-surface-gray-1' : 'border-outline-gray-2'">
                <input v-model="form.visibility" type="radio" :value="v.value" class="mt-0.5" />
                <span>
                  <span class="block text-base font-medium text-ink-gray-8">{{ v.label }}</span>
                  <span class="block text-sm text-ink-gray-5">{{ v.hint }}</span>
                </span>
              </label>
              <div v-if="form.visibility === 'Workspace'" class="ml-1 mt-3 flex items-center gap-2 text-sm text-ink-gray-6">
                People who aren't members
                <select v-model="form.default_access" class="folio-select !w-auto" aria-label="Default access">
                  <option value="Can Edit">can edit</option>
                  <option value="Can View">can only view</option>
                </select>
              </div>
            </div>

            <div v-if="state.boot?.erpnext_installed && !space.is_projects_space">
              <div class="mb-1.5 text-xs text-ink-gray-5">ERPNext project</div>
              <div class="flex items-center gap-2">
                <select v-model="form.project" class="folio-select" aria-label="ERPNext project">
                  <option value="">None</option>
                  <option v-for="p in projects" :key="p.name" :value="p.name">{{ p.project_name }} ({{ p.name }})</option>
                </select>
              </div>
              <p class="mt-1 text-xs text-ink-gray-5">Tasks created with /task in this space go into this project.</p>
            </div>
          </fieldset>

          <div v-if="space.can_manage" class="mt-6 flex items-center justify-end gap-2">
            <span v-if="dirty" class="mr-auto text-sm text-ink-gray-5">Unsaved changes</span>
            <Button label="Cancel" :disabled="!dirty || saving" @click="fillForm(space)" />
            <Button variant="solid" label="Save" :loading="saving" :disabled="!dirty || !form.title.trim()" @click="saveGeneral" />
          </div>

          <section v-if="space.can_manage" class="mt-8 rounded-md border border-outline-red-2 p-4">
            <h3 class="text-base font-medium text-ink-red-6">Delete space</h3>
            <p v-if="space.is_projects_space" class="mt-1 text-sm text-ink-gray-6">
              This space holds every project page, so it can't be deleted.
            </p>
            <template v-else>
              <p class="mt-1 text-sm text-ink-gray-6">
                Permanently deletes this space and its {{ space.page_count }} page{{ space.page_count === 1 ? '' : 's' }}, including any in the trash. This can't be undone.
              </p>
              <Button class="mt-3" theme="red" variant="subtle" label="Delete space…" @click="confirmDelete" />
            </template>
          </section>
        </div>

        <!-- Members -->
        <div v-else class="flex-1 overflow-y-auto px-6 py-5">
          <p class="mb-4 text-sm text-ink-gray-6">
            <template v-if="space.visibility === 'Workspace'">
              Everyone in the workspace {{ space.default_access === 'Can View' ? 'can view' : 'can edit' }} this space. Members below get the access you choose.
            </template>
            <template v-else>Only the members below can see this space.</template>
            Folio Managers can always open every space.
          </p>

          <div v-if="space.can_manage" class="relative mb-4 flex items-center gap-2">
            <div class="relative flex-1">
              <input
                v-model="userQuery"
                class="h-8 w-full rounded border border-outline-gray-2 bg-surface-base px-2 text-base placeholder-ink-gray-4 focus:border-outline-gray-4 focus:ring-0"
                placeholder="Add people by name or email…"
                aria-label="Add member"
                @keydown.down.prevent="move(1)"
                @keydown.up.prevent="move(-1)"
                @keydown.enter.prevent="addMember(suggestions[highlight])"
              />
              <div v-if="userQuery && suggestions.length" class="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-outline-gray-2 bg-surface-elevation-2 p-1 shadow-xl">
                <button
                  v-for="(u, i) in suggestions"
                  :key="u.name"
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-base"
                  :class="i === highlight ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
                  @mouseenter="highlight = i"
                  @click="addMember(u)"
                >
                  <Avatar size="sm" :label="u.full_name || u.name" :image="u.user_image" />
                  <span class="flex-1 truncate text-ink-gray-8">{{ u.full_name || u.name }}</span>
                  <span class="truncate text-xs text-ink-gray-5">{{ u.name }}</span>
                </button>
              </div>
            </div>
            <select v-model="newAccess" class="folio-select !h-8 !w-auto" aria-label="Access for new member">
              <option v-for="a in ACCESS" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>

          <ul class="divide-y divide-outline-gray-1">
            <li v-for="m in space.members" :key="m.user" class="flex items-center gap-3 py-2">
              <Avatar size="md" :label="m.full_name" :image="m.image" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-base text-ink-gray-8">
                  {{ m.full_name }}<span v-if="m.user === state.boot?.user" class="text-ink-gray-5"> (you)</span>
                </div>
                <div class="truncate text-xs text-ink-gray-5">{{ m.user }}</div>
              </div>
              <!-- keyed on version: after a refused change the select must show the server value again -->
              <select
                :key="`${m.user}-${version}`"
                :value="m.access"
                class="folio-select !w-auto"
                :aria-label="`Access for ${m.full_name}`"
                :disabled="!space.can_manage || saving"
                @change="setAccess(m, $event.target.value)"
              >
                <option v-for="a in ACCESS" :key="a" :value="a">{{ a }}</option>
              </select>
              <Button v-if="space.can_manage" variant="ghost" icon="lucide-x" :aria-label="`Remove ${m.full_name}`" :disabled="saving" @click="removeMember(m)" />
            </li>
            <li v-if="!space.members.length" class="py-4 text-base text-ink-gray-5">No members yet.</li>
          </ul>
          <ErrorMessage class="mt-3" :message="error" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, Button, Dialog, ErrorMessage, FormControl, LoadingIndicator, call, dialog, toast } from 'frappe-ui'
import EmojiPicker from '@/components/EmojiPicker.vue'
import { loadWorkspace, state } from '@/data/workspace'
import { debounce } from '@/utils'

const TABS = ['General', 'Members']
const ACCESS = ['Full Access', 'Can Edit', 'Can View']
const VISIBILITY = [
  { value: 'Workspace', label: 'Everyone in the workspace', hint: 'Every Folio user can find and open it.' },
  { value: 'Private', label: 'Only members', hint: "People who aren't members can't see it at all." },
]

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  spaceName: { type: String, default: null },
  initialTab: { type: String, default: 'General' },
})

const router = useRouter()
const space = ref(null)
const tab = ref('General')
const saving = ref(false)
const version = ref(0)
const error = ref('')
const projects = ref([])
const form = reactive({ title: '', icon: '', description: '', visibility: 'Workspace', default_access: 'Can Edit', project: '' })

const userQuery = ref('')
const userResults = ref([])
const highlight = ref(0)
const newAccess = ref('Can Edit')

const FIELDS = ['title', 'icon', 'description', 'visibility', 'default_access', 'project']
const dirty = computed(() => !!space.value && FIELDS.some((f) => (form[f] || '') !== (space.value[f] || '')))
const suggestions = computed(() => userResults.value.filter((u) => !space.value?.members.some((m) => m.user === u.name)))

function fillForm(data) {
  version.value++
  for (const f of FIELDS) form[f] = data[f] || (f === 'visibility' ? 'Workspace' : f === 'default_access' ? 'Can Edit' : '')
}

async function load() {
  space.value = null
  error.value = ''
  try {
    const data = await call('folio.api.spaces.get_space', { name: props.spaceName })
    space.value = data
    fillForm(data)
    if (state.boot?.erpnext_installed && !data.is_projects_space && !projects.value.length) {
      projects.value = await call('folio.api.projects.search_projects', { limit: 30 }).catch(() => [])
    }
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not open the space settings')
    open.value = false
  }
}

watch(open, (value) => {
  if (value) {
    tab.value = props.initialTab
    load()
  }
})

async function run(fn, success) {
  saving.value = true
  error.value = ''
  try {
    const result = await fn()
    if (result?.left) {
      open.value = false
      toast.success('You left the space')
    } else if (result) {
      space.value = result
      fillForm(result)
    }
    await loadWorkspace()
    if (success) toast.success(success)
    return true
  } catch (e) {
    error.value = e?.messages?.[0] || 'Could not save'
    toast.error(error.value)
    // show what the server kept, not what was attempted
    const fresh = await call('folio.api.spaces.get_space', { name: props.spaceName }).catch(() => null)
    if (fresh) {
      space.value = fresh
      fillForm(fresh)
    }
    return false
  } finally {
    saving.value = false
  }
}

function saveGeneral() {
  const changes = Object.fromEntries(FIELDS.filter((f) => (form[f] || '') !== (space.value[f] || '')).map((f) => [f, form[f] || null]))
  run(() => call('folio.api.spaces.update_space', { name: props.spaceName, ...changes }), 'Space updated')
}

const searchUsers = debounce(async (q) => {
  userResults.value = q ? await call('folio.api.workspace.get_users', { query: q, limit: 8 }).catch(() => []) : []
  highlight.value = 0
}, 200)
watch(userQuery, searchUsers)

function move(step) {
  const n = suggestions.value.length
  if (n) highlight.value = (highlight.value + step + n) % n
}

async function addMember(user) {
  if (!user) return
  const ok = await run(() => call('folio.api.spaces.set_member', { name: props.spaceName, user: user.name, access: newAccess.value }))
  if (ok) userQuery.value = ''
}

function setAccess(member, access) {
  if (access !== member.access) run(() => call('folio.api.spaces.set_member', { name: props.spaceName, user: member.user, access }))
}

function removeMember(member) {
  const self = member.user === state.boot?.user
  dialog.confirm({
    title: self ? 'Leave this space?' : `Remove ${member.full_name}?`,
    message:
      space.value.visibility === 'Private'
        ? self
          ? "You won't be able to see this private space any more."
          : `${member.full_name} won't be able to see this private space any more.`
        : 'They keep the access everyone in the workspace has.',
    confirmLabel: self ? 'Leave' : 'Remove',
    theme: 'red',
    onConfirm: () => run(() => call('folio.api.spaces.set_member', { name: props.spaceName, user: member.user, access: null })),
  })
}

function confirmDelete() {
  const { title, page_count: n } = space.value
  dialog.confirm({
    title: `Delete "${title}"?`,
    message: `This permanently deletes the space and its ${n} page${n === 1 ? '' : 's'}. This can't be undone.`,
    confirmLabel: 'Delete space',
    theme: 'red',
    onConfirm: async () => {
      await call('folio.api.spaces.delete_space', { name: props.spaceName })
      open.value = false
      await loadWorkspace()
      toast.success(`Deleted "${title}"`)
      router.push({ name: 'Home' })
    },
  })
}

function reset() {
  space.value = null
  userQuery.value = ''
  error.value = ''
}
</script>
