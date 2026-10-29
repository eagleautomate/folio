// Live ERPNext Task data for task blocks. Blocks ask for a task by name; requests
// made in the same tick are batched into one get_tasks call. Everything known is
// refreshed when the window regains focus, so a status changed in the Desk shows
// up when you come back to the page.
import { reactive } from 'vue'
import { call } from 'frappe-ui'

export const tasks = reactive({})

const queue = new Set()
let timer = null

export function requestTask(name) {
  if (!name) return
  queue.add(name)
  clearTimeout(timer)
  timer = setTimeout(flush, 0)
}

async function flush() {
  const names = [...queue]
  queue.clear()
  if (!names.length) return
  try {
    Object.assign(tasks, await call('folio.api.tasks.get_tasks', { names: JSON.stringify(names) }))
  } catch {
    // leave existing data in place; the block shows a loading state for unknown tasks
  }
}

export function setTask(task) {
  tasks[task.name] = task
}

export function refreshAllTasks() {
  Object.keys(tasks).forEach(requestTask)
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refreshAllTasks)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAllTasks()
  })
}

// ---- editing (board, table, side panel). Each returns the fresh task from ERPNext.

export async function updateTask(name, fields) {
  const task = await call('folio.api.tasks.update_task', { name, ...fields })
  setTask(task)
  return task
}

export async function setAssignees(name, users) {
  const task = await call('folio.api.tasks.set_assignees', { name, users: JSON.stringify(users) })
  setTask(task)
  return task
}

export const TASK_STATUSES = ['Open', 'Working', 'Pending Review', 'Completed', 'Cancelled']
export const TASK_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low']

export function isDone(task) {
  return task.status === 'Completed' || task.status === 'Cancelled'
}

export function isOverdue(task) {
  if (isDone(task)) return false
  if (task.status === 'Overdue') return true
  return !!task.due && new Date(String(task.due).replace(' ', 'T')) < new Date(new Date().toDateString())
}

export function statusTheme(status) {
  return (
    { Open: 'gray', Working: 'blue', 'Pending Review': 'orange', Overdue: 'red', Completed: 'green', Cancelled: 'gray' }[status] ||
    'gray'
  )
}

export function formatDue(value) {
  return new Date(String(value).replace(' ', 'T')).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
