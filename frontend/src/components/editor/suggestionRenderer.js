// Renders a TipTap suggestion popup (slash menu, @mentions) with a Vue list component.
// Positioning is handled by the suggestion plugin's managed `mount()` (floating-ui).
import { VueRenderer } from '@tiptap/vue-3'
import { shift } from '@floating-ui/dom'

// TipTap flips the popup up/down but doesn't keep it inside the screen sideways; on a
// phone the menu would run off the right edge.
export const suggestionFloatingUi = { middleware: [shift({ padding: 8 })] }

export function vueSuggestionRenderer(component) {
  return () => {
    let renderer
    let unmount

    return {
      onStart(props) {
        renderer = new VueRenderer(component, { props, editor: props.editor })
        unmount = props.mount(renderer.element)
      },
      onUpdate(props) {
        renderer?.updateProps(props)
      },
      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          unmount?.()
          unmount = null
          return true
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false
      },
      onExit() {
        unmount?.()
        renderer?.destroy()
        renderer = null
        unmount = null
      },
    }
  }
}
