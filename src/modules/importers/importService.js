import { useFinanceStore } from '@/stores/financeStore.js'
import { useImportStore } from '@/stores/importStore.js'
import { useRulesStore } from '@/stores/rulesStore.js'
import { useSettingsStore } from '@/stores/settingsStore.js'
import { applyRules } from '@/modules/categories/rules.js'
import { refreshOwnTransfers } from '@/modules/transfers/transferService.js'
import { countUncategorized } from '@/modules/categories/review.js'
import { parseXlsx } from './xlsxImporter.js'
import { parseNubank, detectNubankLayout, NOT_NUBANK } from './nubankParser.js'
import { parseMercadoPago } from './mercadoPagoParser.js'
import { parseSantander } from './santanderParser.js'
import { readCsv } from './csv.js'
import { extractPdfItems, detectPdfSource } from './pdf.js'

const parsers = { xlsx: parseXlsx, nubank: parseNubank, mercadopago: parseMercadoPago, santander: parseSantander }

/** Fonte de um .csv solto na página, pelo cabeçalho. Por ora só o Nubank é reconhecido. */
export async function detectCsvSource(file) {
  const { headers } = await readCsv(file)
  if (detectNubankLayout(headers)) return 'nubank'
  throw new Error(NOT_NUBANK)
}

/** Fonte de um .pdf solto na página, pelas marcas impressas no documento. */
export async function detectPdfSourceOfFile(file, readPdf = extractPdfItems) {
  const { pages } = await readPdf(file)
  const source = detectPdfSource(pages)
  if (source) return source // 'mercadopago' | 'santander'
  throw new Error('PDF não reconhecido')
}

const startsWith = (bytes, text) => [...text].every((ch, i) => bytes[i] === ch.charCodeAt(0))

/** Formato pelo CONTEÚDO (não pela extensão): '%PDF' = pdf, 'PK' (zip) = xlsx, o resto é lido como texto (csv). */
async function sniffKind(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (startsWith(head, '%PDF')) return 'pdf'
  if (startsWith(head, 'PK')) return 'xlsx'
  return 'csv'
}

/**
 * Fonte de qualquer arquivo pelo conteúdo: 'xlsx' | 'nubank' | 'mercadopago' | 'santander'.
 * Lança Error com a mensagem do motivo quando não reconhece. `readPdf` existe para os testes (pdfjs em Node).
 */
export async function detectFileSource(file, { readPdf } = {}) {
  const kind = await sniffKind(file)
  if (kind === 'xlsx') return 'xlsx'
  if (kind === 'pdf') return detectPdfSourceOfFile(file, readPdf)
  return detectCsvSource(file)
}

/**
 * Importa o arquivo e soma os lançamentos novos ao livro-caixa. Duplicatas de dados anteriores são ignoradas.
 * `defer`: usado no lote — não roda regras nem transferências aqui (o lote roda uma vez, no fim).
 */
export async function runImport(file, sourceId, { defer = false } = {}) {
  const parse = parsers[sourceId]
  if (!parse) throw new Error(`Fonte de importação desconhecida: ${sourceId}`)

  const importId = crypto.randomUUID() // antes do parse: todo lançamento já nasce com o importId
  const { entries, warnings, summary } = await parse(file, { importId })

  // só devolve o resultado depois das duas gravações no storage
  // categoriza por regra os lançamentos novos (nunca os que o parser já categorizou)
  const toAdd = defer ? entries : applyRules(entries, useRulesStore().rules)
  const { added, skipped } = await useFinanceStore().addEntries(toAdd)
  await useImportStore().addImport({ id: importId, source: sourceId, fileName: file.name, count: added, skipped })
  const period = summary?.periodStart ? { start: summary.periodStart, end: summary.periodEnd } : null
  // PDFs trazem o titular no cabeçalho: aprende o nome e reavalia as transferências entre contas próprias
  if (summary?.holder) await useSettingsStore().addHolderName(summary.holder)
  if (!defer) await refreshOwnTransfers()

  const monthLabel = summary?.month ? `${summary.month}/${summary.year}` : null
  // quantos desta importação ficaram sem categoria (a revisão em lote cuida deles)
  const uncategorized = defer ? 0 : countUncategorized(useFinanceStore().entries.filter(e => e.importId === importId)).count
  return { added, skipped, warnings: warnings || [], period, monthLabel, uncategorized, importId }
}

/** Fim do lote: regras de categoria e detecção de transferências UMA vez, sobre tudo o que entrou. */
export async function finalizeBatch() {
  await useFinanceStore().applyRules(useRulesStore().rules)
  await refreshOwnTransfers()
}

/**
 * Importa vários arquivos, UM por vez (não abre N pdfjs em paralelo); cada arquivo é uma importação no histórico.
 * `sourceId`: arquivos soltos num card específico precisam ser daquela fonte; sem ele, a fonte sai do conteúdo.
 * Falha num arquivo não interrompe os outros. `onProgress({ current, total, fileName })` avisa antes de cada arquivo.
 * Devolve { items: [{ fileName, ok, source?, added?, skipped?, warnings?, error? }], totals }.
 * Pontos de injeção (importOne, detect, finalize) são para os testes.
 */
export async function runImportBatch(files, { sourceId = null, onProgress, importOne = runImport, detect = detectFileSource, finalize = finalizeBatch } = {}) {
  const items = []
  const importIds = []
  try {
    for (const [index, file] of files.entries()) {
      onProgress?.({ current: index + 1, total: files.length, fileName: file.name })
      try {
        let source = sourceId
        if (sourceId) {
          const found = await detect(file).catch(() => null) // não reconheceu? o parser da fonte dá o motivo
          if (found && found !== sourceId) throw new Error(`Este arquivo parece ser de outra fonte (${SOURCE_NAMES[found] || found}), não de ${SOURCE_NAMES[sourceId] || sourceId}.`)
        } else {
          source = await detect(file)
        }
        const result = await importOne(file, source, { defer: true })
        if (result.importId) importIds.push(result.importId)
        items.push({ fileName: file.name, ok: true, source, added: result.added, skipped: result.skipped, warnings: result.warnings || [], period: result.period ?? null, monthLabel: result.monthLabel ?? null })
      } catch (err) {
        items.push({ fileName: file.name, ok: false, error: err?.message || 'Não foi possível ler o arquivo.' })
      }
    }
  } finally {
    await finalize()
  }
  const ok = items.filter(i => i.ok)
  const importedIds = new Set(importIds)
  const uncategorized = importedIds.size
    ? countUncategorized(useFinanceStore().entries.filter(e => importedIds.has(e.importId))).count
    : 0
  return {
    items,
    totals: {
      files: items.length,
      imported: ok.length,
      failed: items.length - ok.length,
      added: ok.reduce((n, i) => n + i.added, 0),
      skipped: ok.reduce((n, i) => n + i.skipped, 0),
      uncategorized
    }
  }
}

const SOURCE_NAMES = { xlsx: 'Planilha Excel', nubank: 'Nubank', mercadopago: 'Mercado Pago', santander: 'Santander' }

/** Remove a importação e só os lançamentos dela. */
export async function deleteImport(id) {
  await Promise.all([useFinanceStore().removeByImport(id), useImportStore().removeImport(id)])
}
