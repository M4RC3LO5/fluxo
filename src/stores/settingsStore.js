import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { normalizeText } from '@/utils/search.js'

const key = (name) => normalizeText(name).replace(/\s+/g, ' ').trim()

/** Configurações do usuário, em 'fluxo:settings': { holderNames: string[] } (nomes do titular, para achar transferências próprias). */
export const useSettingsStore = defineStore('settings', () => {
  const holderNames = ref([])

  const persist = debounced(() => save(KEYS.settings, { holderNames: holderNames.value }))
  watch(holderNames, persist, { deep: true })

  /** Adiciona um nome (sem duplicar, ignorando acento/caixa/espaços). Devolve true se entrou. Grava na hora. */
  async function addHolderName(name) {
    const clean = String(name ?? '').replace(/\s+/g, ' ').trim()
    if (!clean || holderNames.value.some(n => key(n) === key(clean))) return false
    holderNames.value = [...holderNames.value, clean]
    await persist.flush()
    return true
  }

  async function removeHolderName(name) {
    holderNames.value = holderNames.value.filter(n => key(n) !== key(name))
    await persist.flush()
  }

  async function hydrate() {
    const saved = await load(KEYS.settings)
    if (Array.isArray(saved?.holderNames)) holderNames.value = saved.holderNames.filter(n => typeof n === 'string' && n.trim())
  }

  return { holderNames, addHolderName, removeHolderName, hydrate }
})
