import { normalizeText } from '@/utils/search.js'

export const NO_TEXT = 'PDF sem texto (imagem escaneada) não é suportado'

/** Itens de texto de um documento do pdfjs: { pages: [[{ str, x, y, width }]] }, y de cima para baixo. */
export async function itemsFromDocument(pdf) {
  const pages = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const { height } = page.getViewport({ scale: 1 })
    const { items } = await page.getTextContent()
    pages.push(items
      .filter(it => typeof it.str === 'string' && it.str.trim() !== '')
      .map(it => ({ str: it.str.trim(), x: it.transform[4], y: height - it.transform[5], width: it.width })))
  }
  if (!pages.some(p => p.length > 0)) throw new Error(NO_TEXT)
  return { pages }
}

// o mesmo arquivo é lido para detectar a fonte e para importar: a leitura é feita uma vez só
const cache = new WeakMap()

/** Lê o PDF no navegador (uma vez por arquivo). O pdfjs (e seu worker) só é baixado aqui, sob demanda: não pesa no bundle inicial. */
export function extractPdfItems(file) {
  let pending = cache.get(file)
  if (!pending) {
    pending = readPdfItems(file)
    cache.set(file, pending)
    pending.catch(() => cache.delete(file))
  }
  return pending
}

async function readPdfItems(file) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const data = new Uint8Array(await file.arrayBuffer())
  let pdf
  try {
    pdf = await pdfjs.getDocument({ data }).promise
  } catch {
    throw new Error('Não foi possível ler o PDF. Verifique se o arquivo não está corrompido ou protegido por senha.')
  }
  try {
    return await itemsFromDocument(pdf)
  } finally {
    pdf.destroy()
  }
}

const textOf = (pages) => normalizeText(pages.flat().map(i => i.str).join(' ')).replace(/\s+/g, ' ')

/** 'mercadopago' | 'santander' | null, pelas marcas impressas no documento. */
export function detectPdfSource(pages) {
  const text = textOf(pages)
  if (text.includes('mercado pago') && text.includes('extrato de conta')) return 'mercadopago'
  if (text.includes('extrato consolidado inteligente')) return 'santander'
  return null
}
