<template>
  <nav
    data-testid="bottom-nav"
    aria-label="Navegação principal"
    class="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-white/[0.08]"
    style="background: rgba(17,24,39,0.97); backdrop-filter: blur(12px); padding-bottom: env(safe-area-inset-bottom);"
  >
    <ul class="flex h-16">
      <li v-for="item in items" :key="item.to" class="flex-1 min-w-0">
        <router-link
          :to="item.to"
          data-testid="bottom-nav-item"
          :aria-label="item.label"
          class="relative flex h-full min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-slate-400 transition-colors active:bg-white/[0.06]"
          active-class="!text-white"
        >
          <span class="indicator absolute top-0 h-0.5 w-8 rounded-full bg-brand-500 opacity-0 transition-opacity"></span>
          <span class="text-xl leading-none" aria-hidden="true">{{ item.icon }}</span>
          <span class="text-[11px] font-medium leading-none truncate max-w-full px-1">{{ item.label }}</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup>
const items = [
  { to: '/dashboard',   icon: '📊', label: 'Dashboard' },
  { to: '/lancamentos', icon: '📋', label: 'Lançamentos' },
  { to: '/importacoes', icon: '📥', label: 'Importar' },
  { to: '/versoes',     icon: '🗂️', label: 'Versões' },
]
</script>

<style scoped>
.router-link-active .indicator { opacity: 1; }
</style>
