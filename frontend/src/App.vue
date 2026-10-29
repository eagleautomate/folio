<template>
  <FrappeUIProvider>
    <div class="flex h-full w-full overflow-hidden bg-surface-white text-ink-gray-8">
      <Sidebar v-if="state.loaded" />
      <main class="flex min-w-0 flex-1 flex-col">
        <div v-if="error" class="m-auto max-w-sm text-center text-p-sm text-ink-gray-6">
          <p class="font-medium text-ink-gray-8">Folio could not load</p>
          <p class="mt-1">{{ error }}</p>
        </div>
        <LoadingIndicator v-else-if="!state.loaded" class="m-auto size-6 text-ink-gray-5" />
        <router-view v-else :key="$route.params.name || $route.path" />
      </main>
      <SearchDialog />
    </div>
  </FrappeUIProvider>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { FrappeUIProvider, LoadingIndicator } from 'frappe-ui'
import Sidebar from '@/components/Sidebar.vue'
import SearchDialog from '@/components/SearchDialog.vue'
import { state, loadWorkspace } from '@/data/workspace'
import { search } from '@/composables/search'

const error = ref('')

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    search.open = !search.open
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await loadWorkspace()
  } catch (e) {
    error.value = e?.messages?.[0] || e?.message || 'Unknown error'
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
