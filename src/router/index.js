import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardPage.vue')
  },
  {
    path: '/lancamentos',
    name: 'Lancamentos',
    component: () => import('@/views/LancamentosPage.vue')
  },
  {
    path: '/importacoes',
    name: 'Importacoes',
    component: () => import('@/views/ImportacoesPage.vue')
  },
  {
    path: '/versoes',
    name: 'Versoes',
    component: () => import('@/views/VersoesPage.vue')
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
