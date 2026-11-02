import frappeUIPreset from 'frappe-ui/tailwind'
import plugin from 'tailwindcss/plugin'

export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts}',
    './node_modules/frappe-ui/frappe/**/*.{vue,js,ts}',
  ],
  theme: { extend: {} },
  // touch: devices without hover (phones, tablets) — reveal hover-only controls, bigger targets
  plugins: [plugin(({ addVariant }) => addVariant('touch', '@media (hover: none)'))],
}
