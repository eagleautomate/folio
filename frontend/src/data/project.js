// Live ERPNext project data for a project page (header + Tasks tab share one copy).
// Reloads when the window regains focus so changes made in the Desk show up.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { call } from 'frappe-ui'
import { setTask } from '@/data/tasks'

export function useProject(name) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref('')

  async function load() {
    if (!name) return
    loading.value = true
    try {
      data.value = await call('folio.api.projects.get_project', { name })
      data.value.tasks?.forEach(setTask) // task blocks in the Overview stay in sync
      error.value = ''
    } catch (e) {
      error.value = e?.messages?.[0] || 'Could not load the project'
    } finally {
      loading.value = false
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') load()
  }

  onMounted(() => {
    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('focus', load)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { data, loading, error, load }
}
