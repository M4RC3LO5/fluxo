import { normalizeText } from '@/utils/search.js'

const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').trim()

const ENCARGOS = ['multa de atraso', 'juros de atraso', 'iof de atraso']

/**
 * Linhas especiais do Nubank → { category?, transfer?, installment? } (só as chaves que se aplicam).
 * transfer: movimentação entre contas próprias / pagamento de fatura, que não é receita nem gasto.
 */
export function classifyNubank(description, layout) {
  const t = norm(description)

  if (layout === 'conta') {
    if (t.startsWith('resgate rdb') || t.startsWith('aplicacao rdb')) return { transfer: true, category: 'Investimentos' }
    if (t.startsWith('pagamento de fatura')) return { transfer: true, category: 'Pagamento de fatura' }
    return {}
  }

  if (t === 'pagamento recebido') return { transfer: true, category: 'Pagamento de fatura' }
  if (t === 'saldo em atraso') return { transfer: true, category: 'Saldo anterior' }
  if (ENCARGOS.includes(t)) return { category: 'Encargos' }
  if (t.startsWith('iof de "')) return { category: 'IOF' }
  if (t.startsWith('estorno de "')) return { category: 'Estorno' }
  const parcela = /\s-\sparcela (\d+)\/(\d+)$/.exec(t)
  if (parcela) return { installment: { current: Number(parcela[1]), total: Number(parcela[2]) } }
  return {}
}
