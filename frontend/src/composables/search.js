import { reactive } from 'vue'

// Open state of the ⌘K search dialog, shared by the sidebar button and the shortcut.
export const search = reactive({ open: false })
