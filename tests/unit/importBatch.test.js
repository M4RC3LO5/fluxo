import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { setActivePinia, createPinia } from 'pinia'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const disco = new Map()
vi.mock('@/modules/persistence/storage.js', () => ({
  KEYS: { entries: 'e', history: 'h', rules: 'r', settings: 's' },
  load: async (k) => disco.get(k),
  save: async (k, v) => { disco.set(k, JSON.parse(JSON.stringify(v))) },
  debounced: (fn) => Object.assign(() => {}, { flush: () => Promise.resolve(fn()) })
}))

const { itemsFromDocument } = await import('@/modules/importers/pdf.js')
const { detectFileSource, runImport, runImportBatch } = await import('@/modules/importers/importService.js')
const { useFinanceStore } = await import('@/stores/financeStore.js')
const { useImportStore } = await import('@/stores/importStore.js')

const fixture = (name) => {
  const bytes = readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
  return new File([bytes], name)
}
// pdfjs em Node (o leitor do navegador usa o worker do Vite)
const readPdf = async (file) => itemsFromDocument(await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise)
const detect = (file) => detectFileSource(file, { readPdf })

beforeEach(() => { disco.clear(); setActivePinia(createPinia()) })

describe('fonte pelo conteúdo', () => {
  it.each([
    ['nubank_cartao.csv', 'nubank'],
    ['nubank_conta.csv', 'nubank'],
    ['mercadopago_extrato.pdf', 'mercadopago'],
    ['santander_extrato.pdf', 'santander'],
    ['fluxo_exemplo.xlsx', 'xlsx']
  ])('%s → %s', async (name, source) => {
    expect(await detect(fixture(name))).toBe(source)
  })

  it('não olha o nome: um CSV do Nubank com extensão .txt continua Nubank', async () => {
    const f = fixture('nubank_cartao.csv')
    expect(await detect(new File([await f.arrayBuffer()], 'extrato.txt'))).toBe('nubank')
  })

  it('CSV de outro banco e PDF desconhecido são recusados com o motivo', async () => {
    await expect(detect(new File(['a,b\n1,2\n'], 'x.csv'))).rejects.toThrow()
    await expect(detect(fixture('pdf_outro_banco.pdf'))).rejects.toThrow('PDF não reconhecido')
  })
})

describe('lote', () => {
  it('um arquivo que falha não para os outros; regras e transferências rodam UMA vez, no fim', async () => {
    const finalize = vi.fn(async () => {})
    const importOne = vi.fn(async (file, source, opts) => {
      if (source === 'mercadopago') throw new Error('Extrato não conferiu: soma das entradas difere')
      return runImport(file, source, opts)
    })
    const progress = []
    const result = await runImportBatch(
      [fixture('mercadopago_totais_errados.pdf'), fixture('nubank_cartao.csv'), fixture('nubank_conta.csv')],
      { detect, importOne, finalize, onProgress: p => progress.push(`${p.current}/${p.total}`) }
    )

    expect(progress).toEqual(['1/3', '2/3', '3/3'])
    expect(result.items.map(i => i.ok)).toEqual([false, true, true])
    expect(result.items[0]).toMatchObject({ fileName: 'mercadopago_totais_errados.pdf', error: 'Extrato não conferiu: soma das entradas difere' })
    expect(result.items[1]).toMatchObject({ fileName: 'nubank_cartao.csv', source: 'nubank' })
    expect(result.items[1].added).toBeGreaterThan(0)
    expect(result.totals).toMatchObject({ files: 3, imported: 2, failed: 1 })
    expect(result.totals.added).toBe(result.items[1].added + result.items[2].added)
    expect(finalize).toHaveBeenCalledTimes(1)
    // uma importação por arquivo bem-sucedido no histórico; os lançamentos nasceram sem regras aplicadas
    expect(useImportStore().history).toHaveLength(2)
    expect(useFinanceStore().entries).toHaveLength(result.totals.added)
  })

  it('finaliza (regras + transferências) mesmo quando todos falham, e só uma vez', async () => {
    const finalize = vi.fn(async () => {})
    const result = await runImportBatch([new File(['x'], 'a.csv'), new File(['y'], 'b.csv')], { finalize })
    expect(result.totals).toMatchObject({ files: 2, imported: 0, failed: 2, added: 0 })
    expect(finalize).toHaveBeenCalledTimes(1)
  })

  it('arquivo solto num card precisa ser daquela fonte', async () => {
    const importOne = vi.fn()
    const result = await runImportBatch([fixture('nubank_cartao.csv')], { sourceId: 'santander', detect, importOne, finalize: async () => {} })
    expect(importOne).not.toHaveBeenCalled()
    expect(result.items[0].ok).toBe(false)
    expect(result.items[0].error).toMatch(/Nubank.*não de Santander/)
  })

  it('processa em sequência (um por vez)', async () => {
    let running = 0
    let max = 0
    const importOne = async () => { running++; max = Math.max(max, running); await new Promise(r => setTimeout(r, 5)); running--; return { added: 1, skipped: 0 } }
    await runImportBatch([new File(['a'], 'a'), new File(['b'], 'b'), new File(['c'], 'c')], { detect: async () => 'nubank', importOne, finalize: async () => {} })
    expect(max).toBe(1)
  })
})
