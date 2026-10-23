import { normalizeText } from '@/utils/search.js'
import { findCategory } from './catalog.js'

const INSTALLMENT_SUFFIX = /\s*-\s*parcela\s+\d+\/\d+\s*$/

/** Descrição para casar regras: sem acento, minúscula, espaços colapsados e sem o sufixo " - parcela N/M". */
export function normalizeForMatch(description) {
  return normalizeText(description).replace(/\s+/g, ' ').trim().replace(INSTALLMENT_SUFFIX, '').trim()
}

/** De onde veio a categoria: 'bank' | 'rule' | 'manual' | null. Lançamento antigo com categoria e sem origem = 'bank'. */
export function categorySourceOf(entry) {
  return entry.categorySource ?? (entry.category ? 'bank' : null)
}

// regra do usuário vence a seed; entre iguais, o pattern mais longo; empate: a primeira da lista
const rank = (rule) => (rule.origin === 'user' ? 1 : 0) * 1e6 + rule.pattern.length

/** Melhor regra para o lançamento (pattern CONTIDO na descrição normalizada), ou null. */
export function matchRule(entry, rules) {
  const text = normalizeForMatch(entry.description)
  let best = null
  for (const rule of rules) {
    if (!rule.pattern || !text.includes(rule.pattern)) continue
    if (!best || rank(rule) > rank(best)) best = rule
  }
  return best
}

// categoria de saída não vai para entrada (e vice-versa); categoria de fora do catálogo não restringe
function compatible(entry, category) {
  const kind = findCategory(category)?.kind
  if (!kind || (entry.type !== 'in' && entry.type !== 'out')) return true
  return kind === entry.type
}

/** Só estes lançamentos podem ser categorizados por regra: nunca 'bank', 'manual' nem transferência. */
export function isRuleEligible(entry) {
  if (entry.transfer) return false
  const source = categorySourceOf(entry)
  return source === null || source === 'rule'
}

/**
 * Aplica as regras. Devolve uma lista nova (os alterados são cópias; os demais, os mesmos objetos).
 * Só altera lançamentos com categoria nula ou categorySource 'rule'; NUNCA 'bank', 'manual' ou transfer.
 */
export function applyRules(entries, rules) {
  return entries.map(entry => {
    if (!isRuleEligible(entry)) return entry
    const rule = matchRule(entry, rules)
    if (!rule || !compatible(entry, rule.category)) return entry
    if (entry.category === rule.category && entry.categorySource === 'rule') return entry
    return { ...entry, category: rule.category, categorySource: 'rule' }
  })
}

/** Quantos lançamentos seriam atualizados ao aplicar as regras (a prévia do "Criar regra"). */
export function countChanges(entries, rules) {
  const next = applyRules(entries, rules)
  return next.reduce((n, e, i) => n + (e !== entries[i] ? 1 : 0), 0)
}
