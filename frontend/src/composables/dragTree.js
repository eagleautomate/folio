// Drag-and-drop state for the sidebar page tree. One page is dragged at a time;
// each row computes whether the pointer is in its top, middle or bottom third to
// decide between "before", "inside" and "after".
import { reactive } from 'vue'

export const drag = reactive({
  page: null, // name of the page being dragged
  over: null, // name of the row under the pointer
  position: null, // 'before' | 'inside' | 'after'
})

export function dropPosition(event, el) {
  const rect = el.getBoundingClientRect()
  const y = event.clientY - rect.top
  if (y < rect.height * 0.3) return 'before'
  if (y > rect.height * 0.7) return 'after'
  return 'inside'
}

export function resetDrag() {
  drag.page = null
  drag.over = null
  drag.position = null
}
