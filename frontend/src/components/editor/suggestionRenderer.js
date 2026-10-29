// Renders a TipTap suggestion popup (slash menu, @mentions) with a Vue list component.
// Positioning is handled by the suggestion plugin's managed `mount()` (floating-ui).
import { VueRenderer } from '@tiptap/vue-3'

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
