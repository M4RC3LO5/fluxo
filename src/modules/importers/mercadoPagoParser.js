import { normalizeText } from '@/utils/search.js'
import { parseBrNumber } from './csv.js'
import { normalizeEntry } from './normalize.js'
import { classifyMercadoPago } from './mercadoPagoRules.js'
import { extractPdfItems, detectPdfSource } from './pdf.js'

export const NOT_MERCADOPAGO = 'PDF não reconhecido como extrato do Mercado Pago'

const LINE_TOLERANCE = 2.5 // px: itens com y até isto de distância são da mesma linha
const COLUMN_MARGIN = 6 // px de folga à esquerda da faixa de cada coluna
const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').trim()
const cents = (n) => Math.round(n * 100)
const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/
const ID_RE = /^\d{6,}$/
const MONEY_RE = /^R\$\s*-?\s*[\d.,]+$/i

function isoDate(str) {
  const m = DATE_RE.exec(str)
  if (!m) return null
  const [, d, mo, y] = m
  const dt = new Date(Date.UTC(+y, +mo - 1, +d))
  return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +mo - 1 && dt.getUTCDate() === +d ? `${y}-${mo}-${d}` : null
}

/** Itens de uma página → linhas (de cima para baixo), cada uma com itens ordenados por x. "R$" solto é colado ao número. */
function groupLines(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines = []
  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(it.y - last.y) <= LINE_TOLERANCE) last.items.push(it)
    else lines.push({ y: it.y, items: [it] })
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    const merged = []
    for (const it of line.items) {
      const prev = merged[merged.length - 1]
      if (prev && /^R\$$/i.test(prev.str) && /^-?\s*[\d.,]+$/.test(it.str)) prev.str = `R$ ${it.str}`
      else merged.push({ ...it })
    }
    line.items = merged
    line.text = merged.map(i => i.str).join(' ')
  }
  return lines
}

/** Cabeçalho da tabela: linha com Data, Descrição, ID, Valor e Saldo → faixa x da descrição. */
function findTableHeader(lines) {
  for (const line of lines) {
    const t = norm(line.text)
    if (!(t.includes('data') && t.includes('descricao') && t.includes('valor') && t.includes('saldo'))) continue
    const startOf = (re) => line.items.find(i => re.test(norm(i.str)))?.x
    const desc = startOf(/^descricao/)
    const id = startOf(/^id( |$)/) ?? startOf(/^valor/)
    if (desc !== undefined && id !== undefined) return { y: line.y, descFrom: desc - COLUMN_MARGIN, descTo: id - COLUMN_MARGIN }
  }
  return null
}

const LABEL_TOLERANCE = 3 // px: o valor está na mesma altura do rótulo (|dy|)

/**
 * Cabeçalho do documento (acima da tabela, 1ª página). Rótulo e valor são itens separados e rótulos
 * diferentes podem cair na mesma linha (Saldo inicial / Saldo final), então lê por PAR rótulo → valor:
 * o item "R$ ..." imediatamente À DIREITA do rótulo, com |dy| <= 3 px. Também aceita rótulo e valor no mesmo item.
 */
function readSummary(lines, tableY, warnings) {
  const head = lines.filter(l => l.y < tableY)
  const items = head.flatMap(l => l.items)

  const money = (label) => {
    const re = new RegExp(`^${label}:?\\s*(r\\$\\s*-?\\s*[\\d.,]+)?$`)
    for (const it of items) {
      const m = re.exec(norm(it.str))
      if (!m) continue
      if (m[1]) return parseBrNumber(m[1]) // "Entradas: R$ 1,00" num item só
      // o item imediatamente à direita, na mesma altura, tem que ser o valor (não o de outro rótulo mais adiante)
      const next = items
        .filter(v => v !== it && v.x > it.x && Math.abs(v.y - it.y) <= LABEL_TOLERANCE)
        .sort((x, y) => x.x - y.x)[0]
      if (next && MONEY_RE.test(next.str)) return parseBrNumber(next.str)
    }
    return NaN
  }

  // período: as duas datas na altura de "Periodo", em qualquer ordem dos itens
  let period = null
  const label = items.find(i => norm(i.str).includes('periodo'))
  if (label) {
    const band = items.filter(i => Math.abs(i.y - label.y) <= LABEL_TOLERANCE).sort((a, b) => a.x - b.x)
    const dates = band.map(i => i.str).join(' ').match(/\d{2}-\d{2}-\d{4}/g) || []
    if (dates.length >= 2) period = [isoDate(dates[0]), isoDate(dates[1])]
  }

  const cpfIdx = head.findIndex(l => /\bcpf\b/.test(norm(l.text)))
  const summary = {
    holder: cpfIdx > 0 ? head[cpfIdx - 1].text.trim() : '',
    periodStart: period ? period[0] : null,
    periodEnd: period ? period[1] : null,
    entradas: money('entradas'),
    saidas: money('saidas'),
    saldoInicial: money('saldo inicial'),
    saldoFinal: money('saldo final')
  }
  const missing = Object.entries({ periodo: summary.periodStart, Entradas: summary.entradas, Saídas: summary.saidas,
    'Saldo inicial': summary.saldoInicial, 'Saldo final': summary.saldoFinal })
    .filter(([, v]) => v === null || Number.isNaN(v)).map(([k]) => k)
  if (missing.length) throw new Error(`Cabeçalho do extrato incompleto (${missing.join(', ')}). Nada foi importado.`)
  if (!summary.holder) warnings.push('Titular não identificado no cabeçalho: Pix entre contas próprias não serão marcados como transferência.')
  return summary
}

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Conferência obrigatória com os totais impressos. Qualquer divergência recusa o extrato inteiro.
 * `movements`: [{ dueDate, id, amount, balance, ... }] na ordem do documento.
 */
export function verifyStatement(movements, summary) {
  const fail = (what, expected, calculated) => {
    throw new Error(`Extrato não conferiu: ${what}, esperado ${brl(expected)}, calculado ${brl(calculated)}. Nada foi importado.`)
  }

  let prev = summary.saldoInicial
  for (const m of movements) {
    const calculated = prev + m.amount
    if (Math.abs(cents(calculated) - cents(m.balance)) > 1) fail(`saldo após a operação ${m.id}`, m.balance, calculated)
    prev = m.balance
  }

  const entradas = movements.filter(m => m.amount > 0).reduce((s, m) => s + cents(m.amount), 0) / 100
  const saidas = movements.filter(m => m.amount < 0).reduce((s, m) => s + cents(m.amount), 0) / 100
  if (cents(entradas) !== cents(Math.abs(summary.entradas))) fail('Entradas', Math.abs(summary.entradas), entradas)
  if (cents(Math.abs(saidas)) !== cents(Math.abs(summary.saidas))) fail('Saídas', Math.abs(summary.saidas), Math.abs(saidas))
  const saldoFinal = summary.saldoInicial + entradas + saidas
  if (Math.abs(cents(saldoFinal) - cents(summary.saldoFinal)) > 1) fail('Saldo final', summary.saldoFinal, saldoFinal)
}

/**
 * Lógica pura do leitor do extrato "EXTRATO DE CONTA" do Mercado Pago (sem tocar no PDF):
 * itens de texto por página → { entries, warnings, summary }. Lança Error se o extrato não conferir.
 */
export function parseMercadoPagoItems(pages, { importId = null } = {}) {
  const warnings = []
  const pageLines = pages.map(groupLines)

  // 1) estrutura de cada página: faixa da descrição, início da tabela, início do rodapé
  const layouts = []
  let bands = null
  pageLines.forEach((lines, p) => {
    const header = findTableHeader(lines)
    if (header) bands = header
    const footer = lines.find(l => norm(l.text).startsWith('data de geracao'))
    layouts.push({ bands, top: header ? header.y : p === 0 ? Infinity : -Infinity, bottom: footer ? footer.y : Infinity })
  })
  const firstHeader = pageLines.map((l, p) => ({ l, p })).find(({ l }) => findTableHeader(l))
  if (!firstHeader) throw new Error('Tabela "DETALHE DOS MOVIMENTOS" não encontrada. Nada foi importado.')
  const summary = readSummary(pageLines[firstHeader.p], findTableHeader(pageLines[firstHeader.p]).y, warnings)

  // 2) âncoras (data + ID + valor + saldo) e fragmentos de descrição de cada página
  const anchors = [] // { page, y, dueDate, id, amount, balance, frags: [{ key, text }] }
  const fragsByPage = pageLines.map(() => [])
  pageLines.forEach((lines, p) => {
    const { bands: b, top, bottom } = layouts[p]
    if (!b) return
    for (const line of lines) {
      if (!(line.y > top && line.y < bottom)) continue // cabeçalho do documento, da tabela e rodapé ficam fora
      const date = line.items.find(i => DATE_RE.test(i.str))
      const id = line.items.find(i => ID_RE.test(i.str))
      const money = line.items.filter(i => MONEY_RE.test(i.str))
      const inDesc = line.items.filter(i => i !== date && i !== id && !MONEY_RE.test(i.str) && i.x >= b.descFrom && i.x < b.descTo)
      const text = inDesc.map(i => i.str).join(' ')
      if (date && id && money.length >= 2) {
        const dueDate = isoDate(date.str)
        const [valor, saldo] = money
        const amount = parseBrNumber(valor.str)
        const balance = parseBrNumber(saldo.str)
        if (!dueDate || Number.isNaN(amount) || Number.isNaN(balance)) {
          throw new Error(`Linha ${date.str} / ${id.str} ilegível. Nada foi importado.`)
        }
        anchors.push({ page: p, y: line.y, dueDate, id: id.str, amount, balance, frags: [] })
        if (text) fragsByPage[p].push({ y: line.y, text, onAnchor: anchors[anchors.length - 1] })
      } else if (text) {
        fragsByPage[p].push({ y: line.y, text })
      }
    }
  })
  if (anchors.length === 0) throw new Error('Nenhum movimento encontrado no extrato. Nada foi importado.')

  // 3) cada fragmento vai para a âncora mais próxima da mesma página; o que sobra abaixo da última âncora
  //    (mais longe que metade do espaçamento mediano) é o começo da descrição da 1ª âncora da próxima página
  const gaps = []
  const byPage = pages.map((_, p) => anchors.filter(a => a.page === p))
  byPage.forEach(list => list.forEach((a, i) => { if (i > 0) gaps.push(a.y - list[i - 1].y) }))
  const spacing = median(gaps) || 40
  const nextAnchor = (p) => anchors.find(a => a.page > p)

  fragsByPage.forEach((frags, p) => {
    const list = byPage[p]
    for (const f of frags) {
      const key = p * 100000 + f.y
      if (f.onAnchor) { f.onAnchor.frags.push({ key, text: f.text }); continue }
      const last = list[list.length - 1]
      const next = nextAnchor(p)
      if (next && (!last || (f.y > last.y && f.y - last.y > spacing / 2))) {
        next.frags.push({ key, text: f.text })
      } else if (last) {
        const target = list.reduce((best, a) => (Math.abs(a.y - f.y) < Math.abs(best.y - f.y) ? a : best))
        target.frags.push({ key, text: f.text })
      } else {
        warnings.push(`Texto solto ignorado na página ${p + 1}: "${f.text}".`)
      }
    }
  })

  // 4) montagem e conferência
  const movements = anchors.map(a => ({
    dueDate: a.dueDate,
    id: a.id,
    amount: a.amount,
    balance: a.balance,
    description: a.frags.sort((x, y) => x.key - y.key).map(f => f.text).join(' ').replace(/\s+/g, ' ').trim() || `Movimento ${a.id}`
  }))
  verifyStatement(movements, summary)

  const entries = movements.map(m => {
    const rule = classifyMercadoPago(m.description, summary.holder)
    return normalizeEntry({
      id: crypto.randomUUID(),
      dueDate: m.dueDate,
      description: m.description,
      forecast: Math.abs(m.amount),
      paid: Math.abs(m.amount),
      status: 'paid',
      type: m.amount < 0 ? 'out' : 'in',
      category: rule.category,
      transfer: rule.transfer,
      externalId: m.id,
      account: 'mercadopago-conta'
    }, { source: 'mercadopago', importId })
  })
  return { entries, warnings, summary }
}

export async function parseMercadoPago(file, { importId = null } = {}) {
  const { pages } = await extractPdfItems(file)
  if (detectPdfSource(pages) !== 'mercadopago') throw new Error(NOT_MERCADOPAGO)
  return parseMercadoPagoItems(pages, { importId })
}
