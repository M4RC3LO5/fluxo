import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { SEED_RULES } from '@/modules/categories/seedRules.js'
import { normalizeForMatch } from '@/modules/categories/rules.js'
import { normalizeText } from '@/utils/search.js'
import { isTransferCategory } from '@/modules/categories/catalog.js'

/**
 * Regras de categorização. As seeds vêm do código (assim novas versões atualizam o conjunto);
 * só as regras do usuário vão para o IndexedDB ('fluxo:rules').
 */
export const useRulesStore = defineStore('rules', () => {
  const userRules = ref([])

  const rules = computed(() => [...SEED_RULES, ...userRules.value])

  const persist = debounced(() => save(KEYS.rules, userRules.value))
  watch(userRules, persist, { deep: true })

  /** Cria (ou atualiza, se o pattern já existir) uma regra do usuário. Grava na hora e devolve a regra. */
  async function addUserRule(pattern, category) {
    const normalized = normalizeForMatch(pattern)
    if (!normalized || !category) throw new Error('Regra precisa de texto e categoria.')
    const existing = userRules.value.find(r => r.pattern === normalized)
    // categoria de "Não é gasto": a regra marca o lançamento como transferência (action 'transfer')
    const action = isTransferCategory(category) ? 'transfer' : undefined
    let rule
    if (existing) {
      existing.category = category
      if (action) existing.action = action
      else delete existing.action
      rule = existing
    } else {
      rule = { id: crypto.randomUUID(), pattern: normalized, category, origin: 'user', createdAt: new Date().toISOString(), ...(action ? { action } : {}) }
      userRules.value = [...userRules.value, rule]
    }
    await persist.flush()
    return rule
  }

  async function removeRule(id) {
    userRules.value = userRules.value.filter(r => r.id !== id)
    await persist.flush()
  }

  /** Renomeia a categoria nas regras do usuário (renomear categoria própria). Devolve quantas regras mudaram. */
  async function renameCategory(oldName, newName) {
    let n = 0
    userRules.value = userRules.value.map(r => (normalizeText(r.category) === normalizeText(oldName) ? (n++, { ...r, category: newName }) : r))
    if (n) await persist.flush()
    return n
  }

  async function hydrate() {
    const saved = await load(KEYS.rules)
    if (Array.isArray(saved)) userRules.value = saved.filter(r => r && r.pattern && r.category && r.origin === 'user')
  }

  return { userRules, rules, addUserRule, removeRule, renameCategory, hydrate }
})
