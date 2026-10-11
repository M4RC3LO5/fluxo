<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        data-testid="bottom-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="fixed inset-0 z-[60] flex items-end"
      >
        <div data-testid="sheet-backdrop" class="absolute inset-0 bg-black/60" @click="close"></div>
        <div
          class="sheet-panel relative w-full max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-slate-900 shadow-2xl"
          style="padding-bottom: env(safe-area-inset-bottom);"
        >
          <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-2">
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold text-white">{{ title }}</h2>
              <p v-if="subtitle" class="truncate text-xs text-slate-400">{{ subtitle }}</p>
            </div>
            <button
              data-testid="sheet-close"
              aria-label="Fechar"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              @click="close"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-4">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' }
})
const emit = defineEmits(['close'])

function close() { emit('close') }
function onKeydown(e) { if (e.key === 'Escape') close() }

// trava a rolagem do body enquanto aberto; listener de Esc só com o painel aberto
let prevOverflow = ''
function lock() {
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
}
function unlock() {
  document.body.style.overflow = prevOverflow
  window.removeEventListener('keydown', onKeydown)
}

watch(() => props.open, (isOpen, wasOpen) => {
  if (isOpen) lock()
  else if (wasOpen) unlock()
}, { immediate: true })

onUnmounted(() => { if (props.open) unlock() })
</script>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .sheet-panel, .sheet-leave-active .sheet-panel { transition: transform 0.25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet-panel, .sheet-leave-to .sheet-panel { transform: translateY(100%); }
</style>
