import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    meta: { title: 'Dashboard' },
    component: () => import('@/views/DashboardPage.vue')
  },
  {
    path: '/lancamentos',
    name: 'Lancamentos',
    meta: { title: 'Lançamentos' },
    component: () => import('@/views/LancamentosPage.vue')
  },
  {
    path: '/importacoes',
    name: 'Importacoes',
    meta: { title: 'Importar' },
    component: () => import('@/views/ImportacoesPage.vue')
  },
  {
    path: '/versoes',
    redirect: '/importacoes'
  }
]

/**
 * Voltar/avançar: restaura a posição só depois que a página renderizou e atingiu altura
 * suficiente (até ~30 quadros ≈ 500ms); sem isso o scroll cairia no fim de uma página ainda curta.
 */
function restorePosition(pos) {
  return new Promise((resolve) => {
    nextTick(() => {
      let frames = 0
      const check = () => {
        const tallEnough = document.documentElement.scrollHeight >= pos.top + window.innerHeight
        if (tallEnough || ++frames >= 30) resolve({ left: pos.left, top: pos.top, behavior: 'instant' })
        else requestAnimationFrame(check)
      }
      check()
    })
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  // navegação nova (menu, links, drill-down, botões) → topo; voltar/avançar → posição anterior
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return restorePosition(savedPosition)
    return { left: 0, top: 0, behavior: 'instant' }
  }
})

// título da aba do navegador: "<página> · Fluxo"
router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · Fluxo` : 'Fluxo — Gestão Financeira'
})

export default router
