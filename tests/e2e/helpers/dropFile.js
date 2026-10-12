import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const MIME = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
}

/**
 * Simula arrastar e soltar um arquivo: cria DataTransfer + File a partir do arquivo em disco
 * e dispara dragenter/dragover/drop no elemento do seletor.
 * { drop: false } para no dragover (útil para checar o estado "arrastando").
 */
export async function dropFile(page, selector, path, { drop = true } = {}) {
  const name = basename(path)
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  const base64 = readFileSync(path).toString('base64')
  await page.evaluate(({ selector, name, type, base64, drop }) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const dt = new DataTransfer()
    dt.items.add(new File([bytes], name, { type }))
    const target = document.querySelector(selector)
    if (!target) throw new Error(`dropFile: alvo não encontrado: ${selector}`)
    const fire = type_ => target.dispatchEvent(new DragEvent(type_, { bubbles: true, cancelable: true, dataTransfer: dt }))
    fire('dragenter')
    fire('dragover')
    if (drop) fire('drop')
  }, { selector, name, type: MIME[ext] || '', base64, drop })
}
