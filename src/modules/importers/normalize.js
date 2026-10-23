/** Modelo canônico de lançamento, comum a todos os parsers (xlsx, CSV, OFX...). */
export const SOURCES = ['xlsx', 'nubank', 'mercadopago', 'ofx', 'pdf']

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const TYPE_IN = ['receita', 'entrada', 'credito', 'in']
const TYPE_OUT = ['despesa', 'saida', 'debito', 'out']

const text = (v) => String(v ?? '').trim()
const amount = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Coluna tipo reconhecida → 'in'/'out'; sem tipo reconhecido, valor negativo → 'out'; senão null. */
export function normalizeType(rawType, forecast = 0) {
  const t = strip(rawType)
  if (TYPE_IN.includes(t)) return 'in'
  if (TYPE_OUT.includes(t)) return 'out'
  return forecast < 0 ? 'out' : null
}

function normalizeInstallment(i) {
  return Number.isInteger(i?.current) && Number.isInteger(i?.total) && i.current > 0 && i.total >= i.current
    ? { current: i.current, total: i.total }
    : null
}

export function normalizeEntry(raw, { source, importId = null } = {}) {
  if (!SOURCES.includes(source)) throw new Error(`Fonte de importação desconhecida: ${source}`)
  const forecast = amount(raw.forecast)
  return {
    id: raw.id,
    dueDate: raw.dueDate || null,
    description: text(raw.description),
    forecast,
    paid: amount(raw.paid),
    status: raw.status || 'pending',
    responsible: text(raw.responsible),
    payer: text(raw.payer),
    center: text(raw.center),
    notes: text(raw.notes),
    category: text(raw.category) || null,
    externalId: text(raw.externalId) || null, // id da transação na origem (ex.: Identificador do Nubank)
    account: text(raw.account) || null,
    transfer: raw.transfer === true, // entre contas próprias / pagamento de fatura: nem receita nem gasto
    installment: normalizeInstallment(raw.installment), // { current, total } | null
    type: normalizeType(raw.type, forecast),
    source,
    importId
  }
}
