import { useFinanceStore } from '@/stores/financeStore.js'
import { useRulesStore } from '@/stores/rulesStore.js'
import { useSettingsStore } from '@/stores/settingsStore.js'
import { normalizeText } from '@/utils/search.js'

const same = (a, b) => normalizeText(a) === normalizeText(b)

/** Quantos lançamentos e regras do usuário usam a categoria. */
export function categoryUsage(name) {
  return {
    entries: useFinanceStore().countByCategory(name),
    rules: useRulesStore().userRules.filter(r => same(r.category, name)).length
  }
}

/** Renomeia a categoria própria e atualiza os lançamentos e as regras que a usam. Devolve { ok, error?, name?, entries?, rules? }. */
export async function renameCustomCategory(oldName, newName) {
  const result = await useSettingsStore().renameCustomCategory(oldName, newName)
  if (!result.ok) return result
  const entries = await useFinanceStore().renameCategory(oldName, result.name)
  const rules = await useRulesStore().renameCategory(oldName, result.name)
  return { ok: true, name: result.name, entries, rules }
}

/** Remove a categoria própria só se nenhum lançamento nem regra a usar; senão devolve { ok: false, entries, rules }. */
export async function removeCustomCategory(name) {
  const usage = categoryUsage(name)
  if (usage.entries > 0 || usage.rules > 0) return { ok: false, ...usage }
  await useSettingsStore().removeCustomCategory(name)
  return { ok: true }
}

/** "3 lançamentos e 1 regra" */
export function usageLabel({ entries, rules }) {
  const parts = []
  if (entries) parts.push(`${entries} ${entries === 1 ? 'lançamento' : 'lançamentos'}`)
  if (rules) parts.push(`${rules} ${rules === 1 ? 'regra' : 'regras'}`)
  return parts.join(' e ')
}
