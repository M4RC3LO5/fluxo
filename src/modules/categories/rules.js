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

/** Regra que aponta para uma categoria de "Não é gasto": o lançamento vira transferência ('rule'). */
export const isTransferRule = (rule) => rule.action === 'transfer'

// regra do usuário vence a seed; entre iguais, o pattern mais longo; empate: a primeira da lista
const rank = (rule) => (rule.origin === 'user' ? 1 : 0) * 1e6 + rule.pattern.length

/** Melhor regra para o lançamento (pattern CONTIDO na descrição normalizada), ou null. */
export function matchRule(entry, rules) {
  const text = normalizeForMatch(entry.description)
  let best = null
  for (const rule of rules) {
    if (!rule.pattern || !text.includes(rule.pattern)) continue
    if (isTransferRule(rule) && entry.transferSource === 'manual') continue // "Não é transferência" feito por você vale mais que a regra
    if (!best || rank(rule) > rank(best)) best = rule
  }
  return best
}

// categoria de saída não vai para entrada (e vice-versa); categoria de fora do catálogo não restringe;
// categoria de "Não é gasto" serve para Entrada e Saída
export function compatible(entry, category) {
  const kind = findCategory(category)?.kind
  if (!kind || kind === 'transfer' || (entry.type !== 'in' && entry.type !== 'out')) return true
  return kind === entry.type
}

/** Transferência que só existe por causa de uma regra do usuário (a regra some → ela desfaz). */
const isRuleTransfer = (entry) => entry.transfer === true && entry.transferSource === 'rule'

/** Só estes lançamentos podem ser categorizados por regra: nunca 'bank', 'manual' nem transferência (a de regra pode). */
export function isRuleEligible(entry) {
  if (entry.transfer) return isRuleTransfer(entry)
  const source = categorySourceOf(entry)
  return source === null || source === 'rule'
}

// o lançamento depois de a regra valer (ou o mesmo objeto, se nada muda)
function withRule(entry, rule) {
  if (isTransferRule(rule)) {
    if (isRuleTransfer(entry) && entry.category === rule.category && entry.categorySource === 'rule') return entry
    return { ...entry, transfer: true, transferSource: 'rule', pairedWith: null, category: rule.category, categorySource: 'rule' }
  }
  if (!entry.transfer && entry.category === rule.category && entry.categorySource === 'rule') return entry
  // a transferência de regra que passa a ter uma regra comum volta a ser Entrada/Saída
  return { ...entry, transfer: false, transferSource: entry.transfer ? null : entry.transferSource, pairedWith: entry.transfer ? null : entry.pairedWith, category: rule.category, categorySource: 'rule' }
}

/**
 * Aplica as regras. Devolve uma lista nova (os alterados são cópias; os demais, os mesmos objetos).
 * Só altera lançamentos com categoria nula ou categorySource 'rule'; NUNCA 'bank', 'manual' ou transfer
 * (exceto a transferência marcada por regra). Regra com action 'transfer' marca transfer true, transferSource 'rule'.
 */
export function applyRules(entries, rules) {
  return entries.map(entry => {
    if (!isRuleEligible(entry)) return entry
    const rule = matchRule(entry, rules)
    if (!rule || !compatible(entry, rule.category)) return entry
    return withRule(entry, rule)
  })
}

/**
 * Recalcula só o que veio de regra (categorySource 'rule' / transferSource 'rule'), depois que uma regra foi removida:
 * cada um ganha a melhor regra que sobrou ou, se não houver nenhuma, volta a ficar sem categoria
 * (e a transferência de regra volta a ser Entrada/Saída).
 * 'bank', 'manual' e transferência de outra origem nunca são tocados. Devolve uma lista nova (os alterados são cópias).
 */
export function recalculateRuleCategories(entries, rules) {
  return entries.map(entry => {
    const byRule = isRuleTransfer(entry) || (!entry.transfer && categorySourceOf(entry) === 'rule')
    if (!byRule) return entry
    const rule = matchRule(entry, rules)
    if (rule && compatible(entry, rule.category)) return withRule(entry, rule)
    if (isRuleTransfer(entry)) return { ...entry, transfer: false, transferSource: null, pairedWith: null, category: null, categorySource: null }
    if (entry.category == null) return entry
    return { ...entry, category: null, categorySource: null }
  })
}

/** Quantos lançamentos seriam atualizados ao aplicar as regras (a prévia do "Criar regra"). */
export function countChanges(entries, rules) {
  const next = applyRules(entries, rules)
  return next.reduce((n, e, i) => n + (e !== entries[i] ? 1 : 0), 0)
}
