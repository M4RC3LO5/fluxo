import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { normalizeText } from '@/utils/search.js'

const key = (name) => normalizeText(name).replace(/\s+/g, ' ').trim()

/**
 * Configurações do usuário, em 'fluxo:settings': { holderNames, ignoredRecurring }.
 * holderNames: nomes do titular (transferências próprias); ignoredRecurring: chaves de comércio marcadas como "Não é recorrente".
 */
export const useSettingsStore = defineStore('settings', () => {
  const holderNames = ref([])
  const ignoredRecurring = ref([])

  const persist = debounced(() => save(KEYS.settings, { holderNames: holderNames.value, ignoredRecurring: ignoredRecurring.value }))
  watch([holderNames, ignoredRecurring], persist, { deep: true })

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

  /** "Não é recorrente": esconde o item da lista de recorrentes (grava na hora). */
  async function ignoreRecurring(recurringKey) {
    if (!recurringKey || ignoredRecurring.value.includes(recurringKey)) return false
    ignoredRecurring.value = [...ignoredRecurring.value, recurringKey]
    await persist.flush()
    return true
  }

  async function unignoreRecurring(recurringKey) {
    ignoredRecurring.value = ignoredRecurring.value.filter(k => k !== recurringKey)
    await persist.flush()
  }

  async function hydrate() {
    const saved = await load(KEYS.settings)
    if (Array.isArray(saved?.holderNames)) holderNames.value = saved.holderNames.filter(n => typeof n === 'string' && n.trim())
    if (Array.isArray(saved?.ignoredRecurring)) ignoredRecurring.value = saved.ignoredRecurring.filter(k => typeof k === 'string' && k)
  }

  return { holderNames, ignoredRecurring, addHolderName, removeHolderName, ignoreRecurring, unignoreRecurring, hydrate }
})
