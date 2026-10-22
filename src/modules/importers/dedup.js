import { normalizeText } from '@/utils/search.js'

/** Chave de duplicata: vencimento | valor em centavos | descrição sem acento, minúscula e com espaços colapsados. */
export function dedupKey(entry) {
  const cents = Math.round((entry.forecast || 0) * 100)
  const description = normalizeText(entry.description).replace(/\s+/g, ' ').trim()
  return `${entry.dueDate ?? ''}|${cents}|${description}`
}
