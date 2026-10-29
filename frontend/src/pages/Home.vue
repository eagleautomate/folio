<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-4xl px-6 pb-16 pt-16 sm:px-12">
      <h1 class="text-3xl font-bold text-ink-gray-9">{{ greeting }}, {{ firstName }}</h1>
      <p class="mt-1 text-base text-ink-gray-5">Pick up where you left off, or start something new.</p>

      <section class="mt-10">
        <div class="mb-3 flex items-center gap-2 text-sm font-medium text-ink-gray-5">
          <LucideClock class="size-4" /> Recently edited
        </div>
        <div v-if="recent.loading && !recent.data" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="i in 4" :key="i" class="h-32 animate-pulse rounded-lg bg-surface-gray-2" />
        </div>
        <div v-else-if="!recent.data?.length" class="rounded-lg border border-dashed border-outline-gray-2 p-8 text-center">
          <p class="text-base text-ink-gray-6">No pages yet.</p>
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <router-link
            v-for="p in recent.data"
            :key="p.name"
            :to="{ name: 'Page', params: { name: p.name } }"
            class="group flex h-32 flex-col overflow-hidden rounded-lg border border-outline-gray-1 bg-surface-white transition-shadow hover:shadow-md"
          >
            <div class="h-10 shrink-0 bg-surface-gray-2" :style="p.cover ? { background: p.cover } : {}" />
            <div class="-mt-4 flex flex-1 flex-col px-3 pb-2">
              <span class="text-2xl leading-none">
                <template v-if="p.icon">{{ p.icon }}</template>
                <LucideFileText v-else class="size-6 rounded bg-surface-white p-0.5 text-ink-gray-5" />
              </span>
              <span class="mt-1.5 line-clamp-2 text-base font-medium text-ink-gray-8">{{ pageTitle(p) }}</span>
              <span class="mt-auto truncate text-xs text-ink-gray-5">{{ timeAgo(p.last_edited_on) }} · {{ p.space_title }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <section v-if="editableSpaces.length" class="mt-10">
        <div class="mb-3 flex items-center gap-2 text-sm font-medium text-ink-gray-5">
          <LucideSparkles class="size-4" /> Start something
        </div>
        <div class="flex flex-wrap gap-2">
          <Dropdown :options="newPageOptions" align="start">
            <template #trigger>
              <Button variant="solid" icon-left="lucide-plus" label="New page" />
            </template>
          </Dropdown>
          <Button variant="subtle" icon-left="lucide-search" label="Search  ⌘K" @click="search.open = true" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dropdown, createResource } from 'frappe-ui'
import { state, createPage, canEditSpace } from '@/data/workspace'
import { search } from '@/composables/search'
import { pageTitle, timeAgo } from '@/utils'

const router = useRouter()
document.title = 'Home · Folio'

const recent = createResource({ url: 'folio.api.workspace.get_recent', params: { limit: 8 }, auto: true })

const firstName = computed(() => (state.boot?.full_name || '').split(' ')[0])
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
const editableSpaces = computed(() => state.spaces.filter((s) => canEditSpace(s.name)))
const newPageOptions = computed(() =>
  editableSpaces.value.map((s) => ({
    label: `${s.icon ? s.icon + ' ' : ''}${s.title}`,
    onClick: async () => {
      const page = await createPage(s.name)
      router.push({ name: 'Page', params: { name: page.name } })
    },
  })),
)
</script>
