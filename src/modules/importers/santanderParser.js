import { normalizeText } from '@/utils/search.js'
import { parseBrNumber } from './csv.js'
import { normalizeEntry } from './normalize.js'
import { classifySantander } from './santanderRules.js'
import { extractPdfItems, detectPdfSource } from './pdf.js'

export const NOT_SANTANDER = 'PDF não reconhecido como extrato Santander'

const LINE_TOLERANCE = 2.5 // px: itens com y até isto de distância são da mesma linha
const COLUMN_MARGIN = 6 // px de folga à esquerda da faixa de cada coluna
const PAGE_TOP = 45 // acima: título e mês de cada página
const PAGE_BOTTOM = 809 // a partir daqui: rodapé
const LABEL_TOLERANCE = 3
const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').trim()
const cents = (n) => Math.round(n * 100)
const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTH_RE = new RegExp(`\\b(${MONTHS.join('|')})/(\\d{4})\\b`)
const AMOUNT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}-?$|^\d+,\d{2}-?$/
const DAY_RE = /^(\d{2})\/(\d{2})$/
const BALANCE_ROW_RE = /saldo em (\d{2})\/(\d{2})/

// seções do extrato que não são a movimentação da conta corrente
const IGNORED_HEADINGS = ['saldos por periodo', 'debito automatico', 'comprovantes de pagamento', 'creditos contratados',
  'investimentos', 'poupanca', 'pacote de servicos']

/** Valor do Santander tem o sinal NO FIM: "156,00-" = -156,00; "3.226,00" = +3.226,00. Inválido → NaN. */
export function parseSantanderAmount(input) {
  const s = String(input ?? '').trim()
  if (!s) return NaN
  if (s.endsWith('-')) {
    const n = parseBrNumber(s.slice(0, -1).trim())
    return Number.isNaN(n) || n < 0 ? NaN : -n
  }
  return parseBrNumber(s)
}

/** Itens de uma página → linhas (de cima para baixo), cada uma com itens ordenados por x. */
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
    line.text = line.items.map(i => i.str).join(' ')
  }
  return lines
}

/** Colunas da tabela, tiradas do cabeçalho Data | Descrição | Nº Documento | Movimento (R$) | Saldo (R$). */
function tableBands(line) {
  const t = norm(line.text)
  if (!(t.includes('data') && t.includes('descricao') && t.includes('movimento') && t.includes('saldo'))) return null
  const x = (re) => line.items.find(i => re.test(norm(i.str)))?.x
  const data = x(/^data/), desc = x(/^descricao/), doc = x(/^n.? ?documento|^documento|^no documento|^n°/), mov = x(/^movimento/)
  const saldo = line.items.filter(i => /^saldo/.test(norm(i.str))).map(i => i.x).pop()
  if ([data, desc, mov, saldo].some(v => v === undefined)) return null
  return {
    desc: desc - COLUMN_MARGIN,
    doc: (doc ?? mov - 110) - COLUMN_MARGIN,
    mov: mov - COLUMN_MARGIN,
    saldo: saldo - COLUMN_MARGIN
  }
}

function monthFrom(pages) {
  for (const items of pages) {
    for (const it of items) {
      const m = MONTH_RE.exec(norm(it.str))
      if (m) return { name: m[1], number: MONTHS.indexOf(m[1]) + 1, year: Number(m[2]) }
    }
  }
  return null
}

function dayToIso(dd, mm, month) {
  const year = mm > month.number ? month.year - 1 : month.year // 31/12 num extrato de janeiro
  const dt = new Date(Date.UTC(year, mm - 1, dd))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** Conferência obrigatória com os totais impressos; qualquer divergência recusa o extrato inteiro. */
export function verifyStatement(movements, summary, closingBalance) {
  const fail = (what, expected, calculated) => {
    throw new Error(`Extrato não conferiu: ${what}, esperado ${brl(expected)}, calculado ${brl(calculated)}. Nada foi importado.`)
  }

  // saldo do último ponto conhecido + movimentos desde então = saldo impresso
  let known = summary.saldoInicial
  let since = 0
  for (const m of movements) {
    since += cents(m.amount)
    if (m.balance === null) continue
    const calculated = (cents(known) + since) / 100
    if (Math.abs(cents(calculated) - cents(m.balance)) > 1) {
      const [, mm, dd] = /\d{4}-(\d{2})-(\d{2})/.exec(m.dueDate)
      fail(`saldo após o movimento de ${dd}/${mm} (${m.description})`, m.balance, calculated)
    }
    known = m.balance
    since = 0
  }

  const creditos = movements.filter(m => m.amount > 0).reduce((s, m) => s + cents(m.amount), 0) / 100
  const debitos = movements.filter(m => m.amount < 0).reduce((s, m) => s + cents(m.amount), 0) / 100
  if (cents(creditos) !== cents(summary.totalCreditos)) fail('Total de Créditos', summary.totalCreditos, creditos)
  if (cents(Math.abs(debitos)) !== cents(Math.abs(summary.totalDebitos))) fail('Total de Débitos', Math.abs(summary.totalDebitos), Math.abs(debitos))
  const saldoFinal = (cents(summary.saldoInicial) + cents(creditos) + cents(debitos)) / 100
  if (Math.abs(cents(saldoFinal) - cents(summary.saldoFinal)) > 1) fail('Saldo final', summary.saldoFinal, saldoFinal)
  if (Math.abs(cents(saldoFinal) - cents(closingBalance)) > 1) fail('Saldo de fechamento da tabela', closingBalance, saldoFinal)
}

/**
 * Lógica pura do leitor do "EXTRATO CONSOLIDADO INTELIGENTE" do Santander: itens de texto por página →
 * { entries, warnings, summary }. Lança Error se o extrato não conferir.
 */
export function parseSantanderItems(pages, { importId = null } = {}) {
  const warnings = []
  const month = monthFrom(pages)
  if (!month) throw new Error('Mês do extrato não encontrado. Nada foi importado.')

  const resumoLabels = { saldo: [], creditos: null, debitos: null }
  let holder = ''
  let nameNext = false
  let section = null // 'resumo' | 'cc' | 'mov' | 'ignored' | 'poupanca' | null
  let bands = null
  let opening = null
  let closing = null
  let currentDate = null
  let poupancaMoves = 0
  const anchors = []

  for (const rawItems of pages) {
    const items = rawItems.filter(i => i.y >= PAGE_TOP && i.y < PAGE_BOTTOM)
    const lines = groupLines(items)

    // valores do Resumo: par rótulo → número imediatamente à direita, na mesma altura
    const valueOf = (label) => {
      const next = items
        .filter(v => v !== label && v.x > label.x && Math.abs(v.y - label.y) <= LABEL_TOLERANCE)
        .sort((a, b) => a.x - b.x)[0]
      return next && AMOUNT_RE.test(next.str) ? parseSantanderAmount(next.str) : NaN
    }

    for (const line of lines) {
      const text = norm(line.text)
      const first = line.items[0]
      const isHeading = first.x <= 40 && !DAY_RE.test(first.str)

      // — cabeçalhos de seção —
      if (isHeading && /^resumo - [a-z]+\/\d{4}$/.test(text)) { section = 'resumo'; continue }
      if (isHeading && text === 'conta corrente') { section = 'cc'; continue }
      if (isHeading && text.length < 30 && text.startsWith('movimentacao') && section !== 'ignored') {
        section = closing ? 'ignored' : 'mov'
        continue
      }
      if (isHeading && text.length < 60 && IGNORED_HEADINGS.some(h => text.startsWith(h))) {
        section = text.startsWith('poupanca') ? 'poupanca' : 'ignored'
        continue
      }

      if (section === 'resumo') {
        if (nameNext) { holder = line.text.trim(); nameNext = false; continue }
        if (text === 'nome') { nameNext = true; continue }
        for (const it of line.items) {
          const t = norm(it.str)
          if (t.startsWith('saldo de conta corrente em')) resumoLabels.saldo.push(valueOf(it))
          else if (t.startsWith('total de creditos')) resumoLabels.creditos = valueOf(it)
          else if (t.startsWith('total de debitos')) resumoLabels.debitos = valueOf(it)
        }
        continue
      }

      if (section === 'poupanca') {
        // só SALDO ANTERIOR / SALDO ATUAL são esperados; qualquer outra linha com data e valor é movimento
        if (DAY_RE.test(first.str) && line.items.some(i => AMOUNT_RE.test(i.str)) && !/saldo (anterior|atual|em)/.test(text)) poupancaMoves++
        continue
      }

      if (section !== 'mov') continue

      // — tabela da movimentação —
      const header = tableBands(line)
      if (header) { bands = header; continue }
      if (!bands) continue

      const money = line.items.filter(i => AMOUNT_RE.test(i.str))
      const balanceRow = BALANCE_ROW_RE.exec(text)
      if (balanceRow) {
        const value = money.length ? parseSantanderAmount(money[money.length - 1].str) : NaN
        if (Number.isNaN(value)) throw new Error('Linha SALDO EM sem valor. Nada foi importado.')
        if (!opening) opening = value
        else { closing = value; section = 'ignored' } // o 2º SALDO EM fecha a tabela
        continue
      }
      if (!opening) continue

      const dateItem = line.items.find(i => i.x < bands.desc && DAY_RE.test(i.str))
      if (dateItem) {
        const [, dd, mm] = DAY_RE.exec(dateItem.str)
        currentDate = dayToIso(Number(dd), Number(mm), month)
        if (!currentDate) throw new Error(`Data inválida no extrato: ${dateItem.str}. Nada foi importado.`)
      }
      const docItem = line.items.find(i => i.x >= bands.doc && i.x < bands.mov && /^(-|\d+)$/.test(i.str))
      const movItem = line.items.find(i => i.x >= bands.mov && i.x < bands.saldo && AMOUNT_RE.test(i.str))
      const saldoItem = line.items.find(i => i.x >= bands.saldo && AMOUNT_RE.test(i.str))
      const description = line.items.filter(i => i.x >= bands.desc && i.x < bands.doc).map(i => i.str).join(' ').trim()

      if (docItem && movItem) {
        if (!currentDate) throw new Error('Movimento sem data. Nada foi importado.')
        anchors.push({
          dueDate: currentDate,
          amount: parseSantanderAmount(movItem.str),
          balance: saldoItem ? parseSantanderAmount(saldoItem.str) : null,
          lines: description ? [description] : []
        })
      } else if (description && anchors.length) {
        anchors[anchors.length - 1].lines.push(description) // linha logo abaixo: continua a descrição do último movimento
      }
    }
  }

  if (opening === null) throw new Error('Tabela "Movimentação" da conta corrente não encontrada. Nada foi importado.')
  if (closing === null) throw new Error('SALDO EM de fechamento não encontrado. Nada foi importado.')
  if (poupancaMoves > 0) warnings.push('Movimentos da poupança não foram importados')

  const summary = {
    holder,
    month: month.name,
    year: month.year,
    saldoInicial: resumoLabels.saldo[0],
    totalCreditos: resumoLabels.creditos,
    totalDebitos: resumoLabels.debitos,
    saldoFinal: resumoLabels.saldo[1]
  }
  const missing = Object.entries({ 'Saldo inicial': summary.saldoInicial, 'Total de Créditos': summary.totalCreditos,
    'Total de Débitos': summary.totalDebitos, 'Saldo final': summary.saldoFinal })
    .filter(([, v]) => v == null || Number.isNaN(v)).map(([k]) => k)
  if (missing.length) throw new Error(`Resumo do extrato incompleto (${missing.join(', ')}). Nada foi importado.`)
  if (Math.abs(cents(opening) - cents(summary.saldoInicial)) > 1) {
    throw new Error(`Extrato não conferiu: Saldo inicial da tabela, esperado ${brl(summary.saldoInicial)}, calculado ${brl(opening)}. Nada foi importado.`)
  }
  if (anchors.length === 0) throw new Error('Nenhum movimento encontrado no extrato. Nada foi importado.')
  if (anchors.some(a => Number.isNaN(a.amount) || (a.balance !== null && Number.isNaN(a.balance)))) {
    throw new Error('Valor ilegível em um movimento. Nada foi importado.')
  }
  if (!holder) warnings.push('Titular não identificado no Resumo: Pix entre contas próprias não serão marcados como transferência.')

  const movements = anchors.map(a => ({ ...a, description: a.lines.join(' - ') || 'Movimento' }))
  verifyStatement(movements, summary, closing)

  const entries = movements.map(m => {
    const rule = classifySantander(m.lines, holder)
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
      externalId: null, // o Nº Documento não é único
      account: 'santander-cc'
    }, { source: 'santander', importId })
  })
  return { entries, warnings, summary }
}

export async function parseSantander(file, { importId = null } = {}) {
  const { pages } = await extractPdfItems(file)
  if (detectPdfSource(pages) !== 'santander') throw new Error(NOT_SANTANDER)
  return parseSantanderItems(pages, { importId })
}
