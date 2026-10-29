<template>
  <Dialog v-model="open" :options="{ title: 'Trash', size: 'lg' }">
    <template #body-content>
      <LoadingIndicator v-if="trash.loading" class="mx-auto size-5 text-ink-gray-5" />
      <div v-else-if="!trash.data?.length" class="py-8 text-center text-base text-ink-gray-5">
        Trash is empty
      </div>
      <div v-else class="-mx-2 max-h-[60vh] overflow-y-auto">
        <div
          v-for="page in trash.data"
          :key="page.name"
          class="group flex items-center gap-3 rounded px-2 py-1.5 hover:bg-surface-gray-2"
        >
          <span class="w-5 text-center">
            <template v-if="page.icon">{{ page.icon }}</template>
            <LucideFileText v-else class="size-4 text-ink-gray-5" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-base text-ink-gray-8">{{ pageTitle(page) }}</div>
            <div class="text-xs text-ink-gray-5">Deleted {{ timeAgo(page.archived_on) }}</div>
          </div>
          <Button size="sm" variant="ghost" label="Restore" @click="restore(page)" />
          <Button size="sm" variant="ghost" theme="red" icon="lucide-trash-2" aria-label="Delete forever" @click="destroy(page)" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, LoadingIndicator, call, createResource, dialog, toast } from 'frappe-ui'
import { loadWorkspace } from '@/data/workspace'
import { pageTitle, timeAgo } from '@/utils'

const open = defineModel({ type: Boolean, default: false })
const router = useRouter()

const trash = createResource({ url: 'folio.api.pages.get_trash' })

watch(open, (value) => value && trash.reload())

async function restore(page) {
  await call('folio.api.pages.restore_page', { name: page.name })
  await Promise.all([trash.reload(), loadWorkspace()])
  toast.success('Page restored', {
    action: { label: 'Open', onClick: () => router.push({ name: 'Page', params: { name: page.name } }) },
  })
}

function destroy(page) {
  dialog.confirm({
    title: 'Delete forever?',
    message: `"${pageTitle(page)}" and all its sub-pages will be permanently deleted. This cannot be undone.`,
    theme: 'red',
    confirmLabel: 'Delete',
    onConfirm: async () => {
      await call('folio.api.pages.delete_page', { name: page.name })
      await trash.reload()
    },
  })
}
</script>
