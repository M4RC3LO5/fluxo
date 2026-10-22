import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import { useFinanceStore } from './stores/financeStore.js'
import { useImportStore } from './stores/importStore.js'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// hidrata antes de montar para não piscar o estado vazio; hydrate() nunca rejeita
Promise.all([useFinanceStore(pinia).hydrate(), useImportStore(pinia).hydrate()])
  .catch(err => console.warn('[fluxo] falha ao hidratar; seguindo só em memória.', err))
  .finally(() => app.mount('#app'))
