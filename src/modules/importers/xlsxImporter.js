import * as XLSX from 'xlsx'
import { parseDate } from '@/utils/formatters'
import { normalizeEntry } from './normalize.js'

const HEADER_MAP = {
  vencimento: 'dueDate',
  'data vencimento': 'dueDate',
  'data de vencimento': 'dueDate',
  due: 'dueDate',
  'due date': 'dueDate',
  data: 'dueDate',
  descricao: 'description',
  description: 'description',
  nome: 'description',
  name: 'description',
  historico: 'description',
  memo: 'description',
  valor: 'forecast',
  'valor previsto': 'forecast',
  previsto: 'forecast',
  forecast: 'forecast',
  amount: 'forecast',
  value: 'forecast',
  pago: 'paid',
  'valor pago': 'paid',
  paid: 'paid',
  'valor real': 'paid',
  real: 'paid',
  status: 'status',
  situacao: 'status',
  state: 'status',
  responsavel: 'responsible',
  responsible: 'responsible',
  responsabilidade: 'responsible',
  pagador: 'payer',
  payer: 'payer',
  fornecedor: 'payer',
  cliente: 'payer',
  beneficiario: 'payer',
  centro: 'center',
  'centro de custo': 'center',
  'cost center': 'center',
  categoria: 'category',
  category: 'category',
  departamento: 'center',
  tipo: 'type',
  type: 'type',
  'tipo lancamento': 'type',
  obs: 'notes',
  observacao: 'notes',
  observacoes: 'notes',
  notes: 'notes',
  comentario: 'notes',
}

function normalizeHeader(h) {
  return String(h)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function buildColumnMapping(headers) {
  const mapping = {}
  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h)
    const field = HEADER_MAP[norm]
    if (field && !(field in mapping)) {
      mapping[field] = idx
    }
  })
  return mapping
}

function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return raw
  const cleaned = String(raw)
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const val = parseFloat(cleaned)
  return isNaN(val) ? 0 : val
}

function normalizeStatus(raw) {
  if (!raw) return 'pending'
  const s = String(raw).toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (['pago', 'paid', 'concluido', 'realizado', 'liquidado', 'ok'].includes(s)) return 'paid'
  if (['vencido', 'overdue', 'atrasado', 'em atraso'].includes(s)) return 'overdue'
  return 'pending'
}

let _idCounter = Date.now()
function nextId() {
  return `imp_${_idCounter++}`
}

export async function parseXlsx(file, { importId = null } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })

        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        })

        if (!rows || rows.length < 2) {
          return reject(new Error('Planilha vazia ou sem dados suficientes (minimo 1 cabecalho + 1 linha).'))
        }

        let headerRowIdx = 0
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const nonEmpty = rows[i].filter(c => c !== '').length
          if (nonEmpty >= 2) { headerRowIdx = i; break }
        }

        const headers = rows[headerRowIdx].map(h => h ?? '')
        const mapping = buildColumnMapping(headers)
        const warnings = []

        const required = ['dueDate', 'description', 'forecast']
        const missing = required.filter(f => !(f in mapping))
        if (missing.length > 0) {
          if (!('dueDate' in mapping) && headers.length > 0) mapping.dueDate = 0
          if (!('description' in mapping) && headers.length > 1) mapping.description = 1
          if (!('forecast' in mapping) && headers.length > 2) mapping.forecast = 2
          warnings.push(
            `Colunas esperadas nao encontradas pelo nome (${missing.join(', ')}). ` +
            `Usando as primeiras colunas como fallback. ` +
            `Cabecalhos detectados: ${headers.filter(Boolean).join(' | ')}`
          )
        }

        const dataRows = rows.slice(headerRowIdx + 1)
        const entries = []
        let skipped = 0

        dataRows.forEach((row, i) => {
          if (row.every(c => c === '' || c === null || c === undefined)) {
            skipped++
            return
          }

          const get = (field) => {
            const idx = mapping[field]
            return idx !== undefined ? row[idx] : undefined
          }

          const rawDate = get('dueDate')
          const rawDesc = get('description')
          const rawForecast = get('forecast')

          if (!rawDate && !rawDesc && !rawForecast) {
            skipped++
            return
          }

          const dueDate = parseDate(rawDate) || null
          const description = String(rawDesc || '').trim() || `Lancamento ${i + 1}`
          const forecast = parseAmount(rawForecast)
          const paid = parseAmount(get('paid'))
          const status = normalizeStatus(get('status'))
            || (paid > 0 && paid >= forecast && forecast > 0 ? 'paid' : 'pending')
          const responsible = String(get('responsible') || '').trim()
          const payer = String(get('payer') || '').trim()
          const center = String(get('center') || '').trim()
          const category = String(get('category') || '').trim()
          const type = String(get('type') || '').trim()
          const notes = String(get('notes') || '').trim()

          entries.push(normalizeEntry({
            id: nextId(),
            dueDate,
            description,
            forecast,
            paid,
            status,
            responsible,
            payer,
            center,
            category,
            type,
            notes,
          }, { source: 'xlsx', importId }))
        })

        if (skipped > 0) {
          warnings.push(`${skipped} linha(s) ignorada(s) por estarem vazias ou incompletas.`)
        }

        if (entries.length === 0) {
          return reject(new Error('Nenhum lancamento valido encontrado na planilha.'))
        }

        const mappedFields = Object.keys(mapping).map(f => {
          const colIdx = mapping[f]
          return `${f} <- "${headers[colIdx]}"`
        })

        resolve({ entries, warnings, mappedFields })
      } catch (err) {
        reject(new Error(`Erro ao processar planilha: ${err.message}`))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
