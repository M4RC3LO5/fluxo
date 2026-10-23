import { normalizeText } from '@/utils/search.js'

const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').trim()

/**
 * Descrição do extrato do Mercado Pago → { category?, transfer? }.
 * Rendimentos são receita real (não transferência). Pix/transferência só é "entre contas" quando o
 * nome na descrição é o do titular; Pix de terceiros continua Entrada/Saída.
 */
export function classifyMercadoPago(description, holder = '') {
  const t = norm(description)
  const owner = norm(holder)

  if (t === 'rendimentos') return { category: 'Rendimentos' }
  if (t.startsWith('dinheiro retirado') || t.startsWith('dinheiro reservado')) return { transfer: true, category: 'Investimentos' }
  if (t.startsWith('pagamento de fatura')) return { transfer: true, category: 'Pagamento de fatura' }
  if (owner && /^(pix recebido|pix enviado|transferencia)/.test(t) && t.includes(owner)) {
    return { transfer: true, category: 'Transferência entre contas' }
  }
  return {}
}
