import { normalizeText } from '@/utils/search.js'
import { readCsv, parseBrNumber } from './csv.js'
import { normalizeEntry } from './normalize.js'
import { classifyNubank } from './nubankRules.js'

export const NOT_NUBANK = 'CSV não reconhecido como extrato Nubank'

const norm = h => normalizeText(h).trim()

/** Layouts públicos do Nubank: conta (Data,Valor,Identificador,Descrição) e cartão (date,[category,]title,amount). */
export function detectNubankLayout(headers) {
  const set = new Set(headers.map(norm))
  const has = (...cols) => cols.every(c => set.has(c))
  if (has('data', 'valor', 'identificador', 'descricao')) return 'conta'
  if (has('date', 'title', 'amount')) return 'cartao'
  return null
}

/** DD/MM/AAAA ou AAAA-MM-DD → ISO; data inexistente (31/02) → null. */
function parseNubankDate(raw) {
  const s = String(raw ?? '').trim()
  let y, m, d
  let match
  if ((match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) [, d, m, y] = match
  else if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) [, y, m, d] = match
  else return null
  const dt = new Date(Date.UTC(+y, +m - 1, +d))
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return null
  return `${y}-${m}-${d}`
}

export async function parseNubank(file, { importId = null } = {}) {
  const { headers, rows } = await readCsv(file)
  const layout = detectNubankLayout(headers)
  if (!layout) throw new Error(NOT_NUBANK)

  const col = name => headers.findIndex(h => norm(h) === name)
  const idx = layout === 'conta'
    ? { date: col('data'), amount: col('valor'), description: col('descricao'), externalId: col('identificador'), category: -1 }
    : { date: col('date'), amount: col('amount'), description: col('title'), externalId: -1, category: col('category') }
  const cell = (row, i) => (i >= 0 ? String(row[i] ?? '').trim() : '')

  const entries = []
  const warnings = []
  rows.forEach((row, i) => {
    const line = i + 2 // cabeçalho é a linha 1
    const rawDate = cell(row, idx.date)
    const rawAmount = cell(row, idx.amount)
    const dueDate = parseNubankDate(rawDate)
    const amount = parseBrNumber(rawAmount)
    if (!dueDate) return warnings.push(`Linha ${line} ignorada: data inválida ("${rawDate}").`)
    if (Number.isNaN(amount)) return warnings.push(`Linha ${line} ignorada: valor inválido ("${rawAmount}").`)

    // conta: negativo = saída; cartão: compra positiva = saída, pagamento/estorno negativo = entrada
    const out = layout === 'conta' ? amount < 0 : amount > 0
    const description = cell(row, idx.description) || `Lançamento ${line}`
    const rule = classifyNubank(description, layout)
    // a regra só define a categoria se o arquivo não trouxe uma; transferência sempre define
    const category = rule.transfer ? rule.category : cell(row, idx.category) || rule.category
    entries.push(normalizeEntry({
      id: crypto.randomUUID(),
      dueDate,
      description,
      forecast: Math.abs(amount),
      paid: Math.abs(amount),
      status: 'paid',
      type: out ? 'out' : 'in',
      category,
      transfer: rule.transfer,
      installment: rule.installment,
      externalId: cell(row, idx.externalId),
      account: layout === 'conta' ? 'nubank-conta' : 'nubank-cartao'
    }, { source: 'nubank', importId }))
  })

  if (entries.length === 0) throw new Error('Nenhum lançamento válido encontrado no CSV.')
  return { entries, warnings, layout }
}
