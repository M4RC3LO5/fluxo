import { useFinanceStore } from '@/stores/financeStore.js'
import { useImportStore } from '@/stores/importStore.js'
import { parseXlsx } from './xlsxImporter.js'
import { parseNubank, detectNubankLayout, NOT_NUBANK } from './nubankParser.js'
import { parseMercadoPago } from './mercadoPagoParser.js'
import { readCsv } from './csv.js'
import { extractPdfItems, detectPdfSource } from './pdf.js'

const parsers = { xlsx: parseXlsx, nubank: parseNubank, mercadopago: parseMercadoPago }

/** Fonte de um .csv solto na página, pelo cabeçalho. Por ora só o Nubank é reconhecido. */
export async function detectCsvSource(file) {
  const { headers } = await readCsv(file)
  if (detectNubankLayout(headers)) return 'nubank'
  throw new Error(NOT_NUBANK)
}

/** Fonte de um .pdf solto na página, pelas marcas impressas no documento. */
export async function detectPdfSourceOfFile(file) {
  const { pages } = await extractPdfItems(file)
  const source = detectPdfSource(pages)
  if (source === 'mercadopago') return source
  if (source === 'santander') throw new Error('Santander ainda não suportado')
  throw new Error('PDF não reconhecido')
}

/** Importa o arquivo e soma os lançamentos novos ao livro-caixa. Duplicatas de dados anteriores são ignoradas. */
export async function runImport(file, sourceId) {
  const parse = parsers[sourceId]
  if (!parse) throw new Error(`Fonte de importação desconhecida: ${sourceId}`)

  const importId = crypto.randomUUID() // antes do parse: todo lançamento já nasce com o importId
  const { entries, warnings, summary } = await parse(file, { importId })

  // só devolve o resultado depois das duas gravações no storage
  const { added, skipped } = await useFinanceStore().addEntries(entries)
  await useImportStore().addImport({ id: importId, source: sourceId, fileName: file.name, count: added, skipped })
  const period = summary?.periodStart ? { start: summary.periodStart, end: summary.periodEnd } : null
  return { added, skipped, warnings: warnings || [], period }
}

/** Remove a importação e só os lançamentos dela. */
export async function deleteImport(id) {
  await Promise.all([useFinanceStore().removeByImport(id), useImportStore().removeImport(id)])
}
