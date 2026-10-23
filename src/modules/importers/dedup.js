import { normalizeText } from '@/utils/search.js'

/** Com externalId (id da transação na origem): fonte|externalId. Senão: vencimento | valor em centavos | descrição sem acento, minúscula e com espaços colapsados. */
export function dedupKey(entry) {
  if (entry.externalId) return `${entry.source}|${entry.externalId}`
  const cents = Math.round((entry.forecast || 0) * 100)
  const description = normalizeText(entry.description).replace(/\s+/g, ' ').trim()
  return `${entry.dueDate ?? ''}|${cents}|${description}`
}
