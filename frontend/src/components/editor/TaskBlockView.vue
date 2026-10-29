<template>
  <NodeViewWrapper class="folio-task" :class="{ 'is-selected': selected }" data-type="erpnext-task">
    <!-- draft: create a new Task or link an existing one -->
    <div v-if="!node.attrs.task" class="relative" contenteditable="false">
      <div class="flex items-center gap-2 rounded-md border border-outline-gray-2 bg-surface-base px-2 py-1.5">
        <LucideCircleDashed class="size-4 shrink-0 text-ink-gray-4" />
        <input
          ref="input"
          v-model="query"
          class="h-6 flex-1 border-0 bg-transparent p-0 text-base text-ink-gray-8 placeholder-ink-gray-4 focus:ring-0"
          placeholder="Task title, or search existing tasks…"
          :disabled="busy"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="choose(options[highlight])"
          @keydown.esc.prevent="cancel"
          @keydown.backspace="query || cancel()"
          @blur="onBlur"
        />
        <span class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-5">ERPNext Task</span>
      </div>
      <div
        v-if="options.length"
        class="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-outline-gray-2 bg-surface-elevation-2 p-1 shadow-xl"
        @mousedown.prevent
      >
        <button
          v-for="(opt, i) in options"
          :key="opt.key"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-base"
          :class="i === highlight ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
          @mouseenter="highlight = i"
          @click="choose(opt)"
        >
          <LucidePlus v-if="opt.create" class="size-4 text-ink-gray-5" />
          <LucideLink v-else class="size-4 text-ink-gray-5" />
          <span class="min-w-0 flex-1 truncate text-ink-gray-8">
            <template v-if="opt.create">Create task “{{ opt.subject }}”</template>
            <template v-else>{{ opt.subject }}</template>
          </span>
          <span v-if="!opt.create" class="shrink-0 text-xs text-ink-gray-5">{{ opt.name }} · {{ opt.status }}</span>
        </button>
      </div>
      <p v-if="error" class="mt-1 text-sm text-ink-red-4">{{ error }}</p>
    </div>

    <!-- linked task -->
    <div
      v-else
      class="flex items-center gap-2.5 rounded-md border border-outline-gray-1 px-2.5 py-2 hover:border-outline-gray-2"
      contenteditable="false"
    >
      <TaskRow v-if="task && !task.restricted && !task.missing" class="flex-1" :task="task" @updated="onUpdated" />
      <template v-else>
        <LucideLock v-if="task?.restricted" class="size-4 text-ink-gray-4" />
        <LucideCircleAlert v-else-if="task?.missing" class="size-4 text-ink-gray-4" />
        <LoadingIndicator v-else class="size-4 text-ink-gray-4" />
        <span class="flex-1 truncate text-base text-ink-gray-5">
          <template v-if="task?.restricted">A task you don't have access to</template>
          <template v-else-if="task?.missing">{{ node.attrs.subject || 'Task' }} (deleted in ERPNext)</template>
          <template v-else>{{ node.attrs.subject || 'Loading task…' }}</template>
        </span>
      </template>
    </div>
  </NodeViewWrapper>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { LoadingIndicator, call } from 'frappe-ui'
import TaskRow from './TaskRow.vue'
import { tasks, requestTask, setTask } from '@/data/tasks'
import { debounce } from '@/utils'

const props = defineProps(nodeViewProps)

const input = ref(null)
const query = ref('')
const found = ref([])
const highlight = ref(0)
const busy = ref(false)
const error = ref('')

const pageName = computed(() => props.extension.options.context?.pageName)
const task = computed(() => tasks[props.node.attrs.task])

const options = computed(() => {
  const text = query.value.trim()
  const list = text ? [{ key: '__create', create: true, subject: text }] : []
  return list.concat(found.value.map((t) => ({ key: t.name, ...t })))
})

watch(
  () => props.node.attrs.task,
  (name) => name && !tasks[name] && requestTask(name),
  { immediate: true },
)

const search = debounce(async (q) => {
  if (!pageName.value) return
  try {
    found.value = await call('folio.api.tasks.search_tasks', { page: pageName.value, query: q })
  } catch {
    found.value = []
  }
}, 200)

watch(query, (q) => {
  highlight.value = 0
  search(q)
})

let mountedAt = 0
onMounted(() => {
  mountedAt = Date.now()
  if (!props.node.attrs.task && props.editor.isEditable) {
    // TipTap re-focuses the editor a frame after inserting the block; focus the
    // input after that so typing goes into the draft.
    requestAnimationFrame(() => requestAnimationFrame(() => input.value?.focus()))
    search('')
  }
})

function move(step) {
  const n = options.value.length
  if (n) highlight.value = (highlight.value + step + n) % n
}

async function choose(opt) {
  if (!opt || busy.value) return
  error.value = ''
  busy.value = true
  try {
    const created = opt.create
      ? await call('folio.api.tasks.create_task', { page: pageName.value, subject: opt.subject })
      : null
    if (created) setTask(created)
    else requestTask(opt.name)
    const name = created ? created.name : opt.name
    props.updateAttributes({ task: name, subject: created ? created.subject : opt.subject })
    // continue writing below the block
    const pos = props.getPos() + props.node.nodeSize
    props.editor.chain().insertContentAt(pos, { type: 'paragraph' }).focus(pos + 1).run()
  } catch (e) {
    error.value = e?.messages?.[0] || 'Could not create the task'
  } finally {
    busy.value = false
  }
}

function cancel() {
  props.deleteNode()
  props.editor.commands.focus()
}

function onBlur() {
  // an untouched draft disappears when you click away (but not on the editor's
  // own re-focus right after the block is inserted)
  if (Date.now() - mountedAt < 500) return
  setTimeout(() => {
    if (!props.node.attrs.task && !query.value.trim() && !busy.value) props.deleteNode()
  }, 150)
}

function onUpdated(updated) {
  // keep the cached subject (used for search) in step with ERPNext
  if (updated.subject !== props.node.attrs.subject && props.editor.isEditable) {
    props.updateAttributes({ subject: updated.subject })
  }
}
</script>
