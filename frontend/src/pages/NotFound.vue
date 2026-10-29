<template>
  <div class="m-auto text-center">
    <p class="text-lg font-medium text-ink-gray-8">Page not found</p>
    <Button class="mt-4" label="Go home" @click="$router.push({ name: 'Home' })" />
  </div>
</template>

<script setup>
import { Button } from 'frappe-ui'
</script>
