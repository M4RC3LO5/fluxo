import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import { useFinanceStore } from './stores/financeStore.js'
import { useImportStore } from './stores/importStore.js'
import { useRulesStore } from './stores/rulesStore.js'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// hidrata antes de montar para não piscar o estado vazio; hydrate() nunca rejeita
Promise.all([useFinanceStore(pinia).hydrate(), useImportStore(pinia).hydrate(), useRulesStore(pinia).hydrate()])
  .catch(err => console.warn('[fluxo] falha ao hidratar; seguindo só em memória.', err))
  .finally(() => {
    app.mount('#app')
    // sinal de app pronto (testes e2e): montado, com a rota inicial (lazy) já renderizada
    router.isReady().then(nextTick).then(() => { document.documentElement.dataset.ready = '1' })
  })
