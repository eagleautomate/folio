import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    frappeui({
      frappeProxy: true, // dev server proxies /api etc. to the bench
      lucideIcons: true, // <LucideFileText /> components, auto-resolved
      jinjaBootData: true, // window.* boot values from folio/www/folio.py
      buildConfig: {
        indexHtmlPath: '../folio/www/folio.html',
        emptyOutDir: true,
        sourcemap: true,
      },
    }),
    vue(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    // TipTap and frappe-ui must share one copy of each ProseMirror package,
    // otherwise "multiple versions of prosemirror-model were loaded".
    dedupe: [
      'vue',
      'vue-router',
      'frappe-ui',
      '@tiptap/core',
      '@tiptap/pm',
      '@tiptap/vue-3',
      'prosemirror-model',
      'prosemirror-state',
      'prosemirror-view',
      'prosemirror-transform',
    ],
  },
  optimizeDeps: {
    include: ['feather-icons', 'tailwind.config.js', 'prosemirror-state', 'prosemirror-view', 'lowlight'],
  },
  test: {
    environment: 'happy-dom',
  },
})
