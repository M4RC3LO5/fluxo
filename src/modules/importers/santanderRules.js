import { normalizeText } from '@/utils/search.js'

const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').trim()

const TRANSFER_START = /^(pix recebido|pix enviado|ted|transferencia|transf)\b/
const MIN_NAME_PREFIX = 10 // o banco trunca o nome do titular em 25 caracteres

/**
 * Linhas da descrição do extrato do Santander → { category?, transfer? }.
 * Transferência entre contas próprias: 1ª linha de Pix/TED/transferência e 2ª linha igual ao INÍCIO do
 * nome do titular (>= 10 caracteres). Pix de terceiros continua Entrada/Saída.
 */
export function classifySantander(lines, holder = '') {
  const [first = '', second = ''] = lines.map(norm)
  const owner = norm(holder)

  if (TRANSFER_START.test(first) && owner && second.length >= MIN_NAME_PREFIX && owner.startsWith(second)) {
    return { transfer: true, category: 'Transferência entre contas' }
  }
  if (first.startsWith('remuneracao aplicacao automatica')) return { category: 'Rendimentos' }
  if (first.startsWith('operacoes credito imobiliario')) return { category: 'Financiamento imobiliário' }
  if (first.startsWith('tarifa')) return { category: 'Tarifas bancárias' }
  if (/^(juros|iof)\b/.test(first)) return { category: 'Encargos' }
  return {}
}
