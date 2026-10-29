<template>
  <div>
    <ProjectHeader class="mt-2" :project="project.data.value" @updated="(d) => (project.data.value = d)" />

    <nav class="mt-5 flex gap-5 border-b border-outline-gray-1" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="tab === t.id"
        class="-mb-px flex items-center gap-1.5 border-b-2 pb-2 text-base"
        :class="tab === t.id ? 'border-outline-gray-5 font-medium text-ink-gray-9' : 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'"
        @click="setTab(t.id)"
      >
        <component :is="t.icon" class="size-4" />
        {{ t.label }}
        <span v-if="t.count != null" class="rounded bg-surface-gray-2 px-1.5 text-xs text-ink-gray-6">{{ t.count }}</span>
      </button>
    </nav>

    <!-- Overview keeps the editor mounted so autosave and undo history survive tab switches -->
    <div v-show="tab === 'overview'" class="mt-4">
      <slot />
    </div>
    <ProjectTasks
      v-if="tab === 'tasks'"
      class="mt-4"
      :project="project.data.value"
      :page-name="pageName"
      :editable="editable"
      @changed="project.load"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProjectHeader from './ProjectHeader.vue'
import ProjectTasks from './ProjectTasks.vue'
import { useProject } from '@/data/project'
import IconOverview from '~icons/lucide/notebook-text'
import IconTasks from '~icons/lucide/list-checks'

const props = defineProps({
  projectName: { type: String, required: true },
  pageName: { type: String, required: true },
  editable: { type: Boolean, default: true },
})

const route = useRoute()
const router = useRouter()
const project = useProject(props.projectName)

const tab = computed(() => (route.query.tab === 'tasks' ? 'tasks' : 'overview'))
const tabs = computed(() => [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'tasks', label: 'Tasks', icon: IconTasks, count: project.data.value?.counts?.open ?? null },
])

function setTab(id) {
  router.replace({ query: { ...route.query, tab: id === 'overview' ? undefined : id } })
}

defineExpose({ reload: project.load })
</script>
