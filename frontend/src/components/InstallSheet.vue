<template>
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
      <div v-if="install.open" class="fixed inset-0 z-[60] bg-black/30" aria-hidden="true" @click="dismiss" />
    </Transition>
    <Transition enter-active-class="transition-transform duration-200 ease-out" enter-from-class="translate-y-full" leave-active-class="transition-transform duration-150 ease-in" leave-to-class="translate-y-full">
      <section
        v-if="install.open"
        role="dialog"
        aria-label="Add Folio to your Home Screen"
        ref="sheet"
        tabindex="-1"
        class="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-md rounded-t-2xl bg-surface-elevation-2 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl outline-none sm:bottom-4 sm:rounded-2xl"
      >
        <div class="flex items-start gap-3">
          <img :src="iconUrl" alt="" class="size-12 shrink-0 rounded-xl" />
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-ink-gray-9">Add Folio to your Home Screen</h2>
            <p class="mt-0.5 text-base text-ink-gray-6">Open it like an app: full screen, one tap away.</p>
          </div>
          <Button variant="ghost" aria-label="Close" @click="dismiss">
            <template #icon><LucideX class="size-4 text-ink-gray-6" /></template>
          </Button>
        </div>

        <!-- Android / Chrome: the browser can install it directly -->
        <template v-if="install.prompt">
          <Button class="mt-5 w-full" size="md" variant="solid" label="Install Folio" @click="promptInstall" />
        </template>

        <!-- in-app browsers (Instagram, Gmail…) can't add to the Home Screen -->
        <template v-else-if="device.inApp">
          <p class="mt-5 text-base text-ink-gray-7">
            This browser can't add apps to your Home Screen. Open Folio in <b>Safari</b>, then add it from there.
          </p>
          <Button class="mt-4 w-full" size="md" variant="subtle" :label="copied ? 'Link copied' : 'Copy link'" @click="copyLink" />
        </template>

        <ol v-else class="mt-5 flex flex-col gap-3.5 text-base text-ink-gray-8">
          <li class="flex items-start gap-3">
            <span class="step">1</span>
            <span>
              <template v-if="device.browser === 'safari'">
                Tap <b>Share</b> <LucideShare class="inline-icon" /> in Safari's toolbar.
                <span class="block text-sm text-ink-gray-5">Don't see it? Tap <b>⋯</b> first, then Share.</span>
              </template>
              <template v-else-if="device.browser === 'chrome'">
                Tap <b>Share</b> <LucideShare class="inline-icon" /> in the address bar, at the top right.
              </template>
              <template v-else>
                Open the browser menu <LucideEllipsis class="inline-icon" /> and tap <b>Share</b> <LucideShare class="inline-icon" />.
              </template>
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="step">2</span>
            <span>
              Tap <b>Add to Home Screen</b> <LucideSquarePlus class="inline-icon" />.
              <span class="block text-sm text-ink-gray-5">Scroll down the list if you don't see it.</span>
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="step">3</span>
            <span>
              Tap <b>Add</b>. If you see <b>Open as Web App</b>, leave it on.
            </span>
          </li>
        </ol>

        <p v-if="device.ios && !device.inApp" class="mt-4 text-sm text-ink-gray-5">
          The first time you open Folio from your Home Screen, sign in once more: iPhone keeps the app's login separate from Safari's.
        </p>

        <Button v-if="!install.prompt" class="mt-5 w-full" size="md" variant="subtle" label="Not now" @click="dismiss" />
      </section>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import { device, dismiss, install, promptInstall } from '@/composables/install'

const iconUrl = '/assets/folio/images/pwa/icon-192.png'
const copied = ref(false)
const sheet = ref(null)

// focus moves into the sheet so Escape and screen readers start there
watch(
  () => install.open,
  (open) => open && nextTick(() => sheet.value?.focus()),
)

function onKeydown(e) {
  if (e.key === 'Escape' && install.open) dismiss()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${location.origin}/folio`)
    copied.value = true
  } catch {
    // clipboard refused: nothing else to do
  }
}
</script>

<style scoped>
.step {
  @apply flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-gray-3 text-sm font-semibold text-ink-gray-8;
}
.inline-icon {
  @apply -mt-0.5 inline size-4 align-middle text-ink-blue-6;
}
</style>
