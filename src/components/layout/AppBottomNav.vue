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
          @click="onItemClick(item)"
          class="nav-item flex h-full min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 text-slate-400"
        >
          <!-- pílula do item ativo (Material 3): ~64x32 atrás do ícone -->
          <span class="relative flex h-8 w-16 items-center justify-center">
            <span class="pill absolute inset-0 rounded-full bg-brand-500/20"></span>
            <svg class="relative h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true" v-html="item.icon"></svg>
          </span>
          <span class="label max-w-full truncate px-1 text-[11px] font-medium leading-none">{{ item.label }}</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

// tocar no item da página atual: o router ignora a navegação duplicada, então rolamos ao topo aqui
function onItemClick(item) {
  if (route.path === item.to) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ícones de traço (24x24, currentColor) para herdar a cor do estado (cinza / marca)
const items = [
  { to: '/dashboard',   label: 'Dashboard',   icon: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>' },
  { to: '/lancamentos', label: 'Lançamentos', icon: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>' },
  { to: '/importacoes', label: 'Importar',    icon: '<path d="M12 3v12M7 10l5 5 5-5M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17"/>' },
]
</script>

<style scoped>
.pill {
  opacity: 0;
  transform: scaleX(0.4);
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.nav-item { transition: color 0.2s ease; }
.nav-item .label { transition: color 0.2s ease; }
/* ativo: pílula + ícone e rótulo na cor da marca, rótulo semibold */
.nav-item.router-link-active { color: var(--color-brand-400); }
.nav-item.router-link-active .pill { opacity: 1; transform: scaleX(1); }
.nav-item.router-link-active .label { font-weight: 600; }
</style>
