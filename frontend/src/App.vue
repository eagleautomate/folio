<template>
  <FrappeUIProvider>
    <div class="folio-safe flex h-full w-full overflow-hidden bg-surface-base text-ink-gray-8">
      <!-- mobile: the sidebar is a drawer over the page -->
      <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
        <div v-if="layout.mobile && layout.drawerOpen" class="fixed inset-0 z-30 bg-black/30" aria-hidden="true" @click="closeDrawer" />
      </Transition>
      <Transition
        :enter-active-class="layout.mobile ? 'transition-transform duration-200 ease-out' : ''"
        :enter-from-class="layout.mobile ? '-translate-x-full' : ''"
        :leave-active-class="layout.mobile ? 'transition-transform duration-150 ease-in' : ''"
        :leave-to-class="layout.mobile ? '-translate-x-full' : ''"
      >
        <!-- v-show keeps the sidebar's dialogs and expanded state alive while it's hidden -->
        <Sidebar
          v-if="state.loaded"
          v-show="sidebarVisible()"
          :class="layout.mobile ? 'folio-safe-drawer fixed inset-y-0 left-0 z-40 !w-72 max-w-[85vw] shadow-2xl' : ''"
        />
      </Transition>
      <main class="relative flex min-w-0 flex-1 flex-col">
        <!-- Page has its own header with the toggle; other screens get it floating top-left -->
        <SidebarToggle v-if="state.loaded && $route.name !== 'Page'" class="!absolute left-3 top-1.5 z-10" />
        <div v-if="error" class="m-auto max-w-sm text-center text-p-sm text-ink-gray-6">
          <p class="font-medium text-ink-gray-8">Folio could not load</p>
          <p class="mt-1">{{ error }}</p>
        </div>
        <LoadingIndicator v-else-if="!state.loaded" class="m-auto size-6 text-ink-gray-5" />
        <router-view v-else :key="$route.params.name || $route.path" />
      </main>
      <SearchDialog />
      <InstallSheet />
    </div>
  </FrappeUIProvider>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FrappeUIProvider, LoadingIndicator } from 'frappe-ui'
import Sidebar from '@/components/Sidebar.vue'
import SearchDialog from '@/components/SearchDialog.vue'
import SidebarToggle from '@/components/SidebarToggle.vue'
import InstallSheet from '@/components/InstallSheet.vue'
import { maybeShow as maybeShowInstall } from '@/composables/install'
import { state, loadWorkspace } from '@/data/workspace'
import { search } from '@/composables/search'
import { layout, sidebarVisible, toggleSidebar, closeDrawer } from '@/composables/layout'

const error = ref('')
const router = useRouter()

// opening anything from the drawer takes you there, so the drawer gets out of the way
router.afterEach(closeDrawer)

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    search.open = !search.open
  } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    // ⌘\ / Ctrl+\ like Notion
    e.preventDefault()
    toggleSidebar()
  } else if (e.key === 'Escape' && layout.drawerOpen && !document.querySelector('[role="menu"], [role="dialog"]')) {
    // Escape closes the topmost thing only: an open menu or dialog first, then the drawer
    closeDrawer()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await loadWorkspace()
    // on a phone, offer "Add to Home Screen" once the workspace is on screen
    setTimeout(maybeShowInstall, 1500)
  } catch (e) {
    error.value = e?.messages?.[0] || e?.message || 'Unknown error'
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
