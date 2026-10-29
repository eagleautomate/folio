<template>
  <Dialog
    v-model="open"
    :options="{
      title: 'New project',
      message: 'Creates the project in ERPNext and its page in Folio.',
      actions: [{ label: 'Create project', variant: 'solid', loading: saving, onClick: create }],
    }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <FormControl v-model="form.project_name" label="Name" placeholder="e.g. Office move" autofocus @keydown.enter="create" />
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5 text-xs text-ink-gray-5">
            Start
            <input v-model="form.expected_start_date" type="date" class="folio-select !h-8" />
          </label>
          <label class="flex flex-col gap-1.5 text-xs text-ink-gray-5">
            End
            <input v-model="form.expected_end_date" type="date" class="folio-select !h-8" :min="form.expected_start_date || undefined" />
          </label>
        </div>
        <FormControl
          v-model="form.priority"
          type="select"
          label="Priority"
          :options="['Low', 'Medium', 'High'].map((p) => ({ label: p, value: p }))"
        />
        <ErrorMessage :message="error" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { Dialog, ErrorMessage, FormControl, call } from 'frappe-ui'

const open = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['created'])

const blank = () => ({ project_name: '', expected_start_date: '', expected_end_date: '', priority: 'Medium' })
const form = reactive(blank())
const saving = ref(false)
const error = ref('')

async function create() {
  if (!form.project_name.trim()) {
    error.value = 'Give the project a name'
    return
  }
  if (form.expected_start_date && form.expected_end_date && form.expected_end_date < form.expected_start_date) {
    error.value = 'The end date is before the start date'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const result = await call('folio.api.projects.create_project', { ...form })
    open.value = false
    Object.assign(form, blank())
    emit('created', result)
  } catch (e) {
    error.value = e?.messages?.[0] || 'Could not create the project'
  } finally {
    saving.value = false
  }
}
</script>
