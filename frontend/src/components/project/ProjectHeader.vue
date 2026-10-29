<template>
  <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-gray-6">
    <template v-if="project && !project.restricted && !project.missing">
      <Dropdown v-if="project.can_edit" :options="statusOptions" align="start">
        <template #trigger>
          <button class="flex items-center gap-1" aria-label="Change project status">
            <Badge :theme="statusTheme(project.status)" :label="project.status" />
            <LucideChevronDown class="size-3 text-ink-gray-5" />
          </button>
        </template>
      </Dropdown>
      <Badge v-else :theme="statusTheme(project.status)" :label="project.status" />

      <span class="flex items-center gap-2" :title="`${pct}% complete`">
        <span class="h-1.5 w-24 overflow-hidden rounded-full bg-surface-gray-3">
          <span class="block h-full rounded-full bg-surface-gray-7" :style="{ width: `${pct}%` }" />
        </span>
        {{ pct }}%
      </span>
      <span v-if="dates" class="flex items-center gap-1"><LucideCalendar class="size-3.5" /> {{ dates }}</span>
      <span v-if="project.priority" class="flex items-center gap-1"><LucideFlag class="size-3.5" /> {{ project.priority }}</span>
      <span v-if="project.customer" class="flex items-center gap-1" :title="project.customer">
        <LucideBuilding2 class="size-3.5" /> {{ project.customer_name || project.customer }}
      </span>
      <div v-if="project.team.length" class="flex -space-x-1.5" :title="project.team.map((t) => t.full_name).join(', ')">
        <Avatar
          v-for="p in project.team.slice(0, 6)"
          :key="p.user"
          size="sm"
          :label="p.full_name"
          :image="p.image"
          class="ring-2 ring-outline-base"
        />
        <span v-if="project.team.length > 6" class="pl-2.5 text-xs">+{{ project.team.length - 6 }}</span>
      </div>
      <a
        :href="`/desk/project/${project.name}`"
        target="_blank"
        class="ml-auto flex items-center gap-1 hover:text-ink-gray-8"
        :title="`Open ${project.name} in ERPNext`"
      >
        {{ project.name }} <LucideExternalLink class="size-3.5" />
      </a>
    </template>
    <span v-else-if="project?.restricted" class="flex items-center gap-1"><LucideLock class="size-3.5" /> You don't have access to this project in ERPNext</span>
    <span v-else-if="project?.missing" class="flex items-center gap-1"><LucideCircleAlert class="size-3.5" /> This project was deleted in ERPNext</span>
    <span v-else class="flex items-center gap-2"><LoadingIndicator class="size-3.5" /> Loading project…</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Avatar, Badge, Dropdown, LoadingIndicator, call, toast } from 'frappe-ui'

const props = defineProps({ project: { type: Object, default: null } })
const emit = defineEmits(['updated'])

const pct = computed(() => Math.round(Math.min(100, props.project?.percent_complete || 0)))

const dates = computed(() => {
  const thisYear = new Date().getFullYear()
  const fmt = (v) => {
    const d = new Date(`${v}T00:00:00`)
    const opts = { day: 'numeric', month: 'short', ...(d.getFullYear() !== thisYear && { year: 'numeric' }) }
    return d.toLocaleDateString(undefined, opts)
  }
  const { expected_start_date: s, expected_end_date: e } = props.project || {}
  if (s && e) return `${fmt(s)} – ${fmt(e)}`
  return e ? `Due ${fmt(e)}` : s ? `From ${fmt(s)}` : ''
})

const statusOptions = computed(() =>
  ['Open', 'On hold', 'Completed', 'Cancelled'].map((status) => ({
    label: status,
    onClick: () => setStatus(status),
  })),
)

async function setStatus(status) {
  if (status === props.project.status) return
  try {
    emit('updated', await call('folio.api.projects.set_status', { name: props.project.name, status }))
  } catch (e) {
    toast.error(e?.messages?.[0] || 'Could not change the status')
  }
}

function statusTheme(status) {
  return { Open: 'blue', 'On hold': 'orange', Completed: 'green', Cancelled: 'gray' }[status] || 'gray'
}
</script>
