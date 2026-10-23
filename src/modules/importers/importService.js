import { useFinanceStore } from '@/stores/financeStore.js'
import { useImportStore } from '@/stores/importStore.js'
import { parseXlsx } from './xlsxImporter.js'

const parsers = { xlsx: parseXlsx }

/** Importa o arquivo e soma os lançamentos novos ao livro-caixa. Duplicatas de dados anteriores são ignoradas. */
export async function runImport(file, sourceId) {
  const parse = parsers[sourceId]
  if (!parse) throw new Error(`Fonte de importação desconhecida: ${sourceId}`)

  const importId = crypto.randomUUID() // antes do parse: todo lançamento já nasce com o importId
  const { entries, warnings } = await parse(file, { importId })

  // só devolve o resultado depois das duas gravações no storage
  const { added, skipped } = await useFinanceStore().addEntries(entries)
  await useImportStore().addImport({ id: importId, source: sourceId, fileName: file.name, count: added, skipped })
  return { added, skipped, warnings: warnings || [] }
}

/** Remove a importação e só os lançamentos dela. */
export async function deleteImport(id) {
  await Promise.all([useFinanceStore().removeByImport(id), useImportStore().removeImport(id)])
}
