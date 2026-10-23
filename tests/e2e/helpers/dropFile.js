import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { waitAppReady } from './appReady.js'

const MIME = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
}

/**
 * Simula arrastar e soltar arquivos: cria DataTransfer + File(s) a partir dos arquivos em disco
 * e dispara dragenter/dragover/drop no elemento do seletor. `paths` é um caminho ou uma lista (vários arquivos de uma vez).
 * { drop: false } para no dragover (útil para checar o estado "arrastando").
 */
export async function dropFile(page, selector, paths, { drop = true } = {}) {
  const files = [].concat(paths).map(path => {
    const name = basename(path)
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
    return { name, type: MIME[ext] || '', base64: readFileSync(path).toString('base64') }
  })
  await waitAppReady(page) // listeners de drop são registrados quando a rota monta
  await page.waitForSelector(selector, { state: 'attached' })
  await page.evaluate(({ selector, files, drop }) => {
    const dt = new DataTransfer()
    for (const { name, type, base64 } of files) {
      dt.items.add(new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], name, { type }))
    }
    const target = document.querySelector(selector)
    if (!target) throw new Error(`dropFile: alvo não encontrado: ${selector}`)
    const fire = type_ => target.dispatchEvent(new DragEvent(type_, { bubbles: true, cancelable: true, dataTransfer: dt }))
    fire('dragenter')
    fire('dragover')
    if (drop) fire('drop')
  }, { selector, files, drop })
}
