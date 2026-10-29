<template>
  <Dialog v-model="search.open" :options="{ size: 'xl', position: 'top' }" @after-leave="reset">
    <template #body>
      <div class="flex items-center gap-2 border-b border-outline-gray-1 px-4">
        <LucideSearch class="size-4 text-ink-gray-5" />
        <input
          ref="input"
          v-model="query"
          class="h-12 flex-1 border-0 bg-transparent px-0 text-lg text-ink-gray-8 placeholder-ink-gray-4 focus:ring-0"
          placeholder="Search pages…"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="openSelected"
        />
        <LoadingIndicator v-if="loading" class="size-4 text-ink-gray-5" />
      </div>
      <div class="max-h-[60vh] overflow-y-auto p-2">
        <div v-if="!results.length && !loading" class="px-3 py-6 text-center text-base text-ink-gray-5">
          {{ query ? 'No pages match' : 'No pages yet' }}
        </div>
        <div v-else class="px-2 pb-1 text-xs font-medium text-ink-gray-5">
          {{ query ? 'Results' : 'Recently edited' }}
        </div>
        <button
          v-for="(r, i) in results"
          :key="r.name"
          class="flex w-full items-start gap-3 rounded px-3 py-2 text-left"
          :class="i === selected ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
          @mouseenter="selected = i"
          @click="go(r)"
        >
          <span class="mt-0.5 w-5 text-center text-base leading-none">
            <template v-if="r.icon">{{ r.icon }}</template>
            <LucideFileText v-else class="size-4 text-ink-gray-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-medium text-ink-gray-8">{{ pageTitle(r) }}</span>
            <span v-if="r.snippet" class="block truncate text-sm text-ink-gray-5">{{ r.snippet }}</span>
          </span>
          <span class="shrink-0 text-xs text-ink-gray-4">{{ r.space_title }}</span>
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog, LoadingIndicator, call } from 'frappe-ui'
import { search } from '@/composables/search'
import { debounce, pageTitle } from '@/utils'

const router = useRouter()
const input = ref(null)
const query = ref('')
const results = ref([])
const selected = ref(0)
const loading = ref(false)
let requestId = 0

const runSearch = debounce(async (q) => {
  const id = ++requestId
  loading.value = true
  try {
    const rows = await call('folio.api.workspace.search', { query: q })
    if (id === requestId) {
      results.value = rows
      selected.value = 0
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}, 150)

watch(query, (q) => runSearch(q))
watch(
  () => search.open,
  async (open) => {
    if (!open) return
    runSearch.flush('')
    await nextTick()
    input.value?.focus()
  },
)

function move(step) {
  if (!results.value.length) return
  selected.value = (selected.value + step + results.value.length) % results.value.length
}

function go(r) {
  search.open = false
  router.push({ name: 'Page', params: { name: r.name } })
}

function openSelected() {
  const r = results.value[selected.value]
  if (r) go(r)
}

function reset() {
  query.value = ''
  results.value = []
}
</script>
