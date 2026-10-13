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
    name: 'Versoes',
    meta: { title: 'Versões' },
    component: () => import('@/views/VersoesPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// título da aba do navegador: "<página> · Fluxo"
router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · Fluxo` : 'Fluxo — Gestão Financeira'
})

export default router
