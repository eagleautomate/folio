// Catches mistakes the Vite build lets through (e.g. a missing import in <script setup>).
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['node_modules/**', '../folio/public/**', 'e2e/shots/**', 'auto-imports.d.ts', 'components.d.ts'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/no-undef-components': ['error', { ignorePatterns: ['^Lucide', '^router-', '^RouterLink', '^RouterView', '^Teleport', '^Transition'] }],
    },
  },
]
