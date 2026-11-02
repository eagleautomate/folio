<template>
  <!-- shown only while the sidebar is hidden: collapsed on desktop, closed drawer on mobile -->
  <Button
    v-if="!sidebarVisible()"
    variant="ghost"
    :aria-label="layout.mobile ? 'Open menu' : 'Show sidebar'"
    :title="layout.mobile ? undefined : 'Show sidebar (⌘\\)'"
    @click="toggleSidebar"
  >
    <template #icon>
      <LucideMenu v-if="layout.mobile" class="size-4 text-ink-gray-7" />
      <LucidePanelLeftOpen v-else class="size-4 text-ink-gray-7" />
    </template>
  </Button>
</template>

<script setup>
import { Button } from 'frappe-ui'
import { layout, sidebarVisible, toggleSidebar } from '@/composables/layout'
</script>
