<template>
  <header class="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b border-white/[0.05]"
    style="background: rgba(11,15,26,0.85); backdrop-filter: blur(12px);">
    <div class="flex items-center gap-3 min-w-0">
      <button @click="toggleSidebar" aria-label="Alternar menu lateral" class="hidden md:block p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      <!-- celular: nome da página atual; desktop: marca -->
      <span data-testid="page-title" class="truncate text-white font-bold text-lg tracking-tight md:hidden">{{ pageTitle }}</span>
      <span class="hidden text-white font-bold text-lg tracking-tight md:inline">Fluxo</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs text-slate-500 whitespace-nowrap">{{ currentDate }}</span>
    </div>
  </header>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'

const sidebarOpen = inject('sidebarOpen')
const route = useRoute()
const pageTitle = computed(() => route.meta?.title || 'Fluxo')

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

const currentDate = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
</script>
