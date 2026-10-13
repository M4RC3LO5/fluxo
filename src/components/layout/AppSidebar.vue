<template>
  <aside data-testid="sidebar" class="hidden md:flex fixed left-0 top-14 bottom-0 z-40 flex-col transition-all duration-300 border-r border-white/[0.05]"
    :class="sidebarOpen ? 'w-64' : 'w-16'"
    style="background: rgba(17,24,39,0.95); backdrop-filter: blur(12px);">
    <nav class="flex-1 py-4 space-y-1 px-2">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        @click="onItemClick(item)"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all group"
        active-class="text-white bg-brand-600/20 border border-brand-500/20"
      >
        <span class="text-xl shrink-0">{{ item.icon }}</span>
        <span v-if="sidebarOpen" class="text-sm font-medium truncate">{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { inject } from 'vue'
import { useRoute } from 'vue-router'

const sidebarOpen = inject('sidebarOpen')
const route = useRoute()

// clicar no item da página atual: o router ignora a navegação duplicada, então rolamos ao topo aqui
function onItemClick(item) {
  if (route.path === item.to) window.scrollTo({ top: 0, behavior: 'smooth' })
}

const navItems = [
  { to: '/dashboard',   icon: '📊', label: 'Dashboard' },
  { to: '/lancamentos', icon: '📋', label: 'Lançamentos' },
  { to: '/importacoes', icon: '📥', label: 'Importações' },
  { to: '/versoes',     icon: '🗂️',  label: 'Versões' },
]
</script>
