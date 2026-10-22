import { get, set, clear, createStore } from 'idb-keyval'
import { toRaw } from 'vue'

export const SCHEMA_VERSION = 1

export const KEYS = {
  schema: 'fluxo:schema',
  entries: 'fluxo:finance:entries',
  history: 'fluxo:import:history',
  activeVersionId: 'fluxo:import:activeVersionId'
}

let store = null
let schemaChecked = null // Promise<boolean>: true = storage compatível
let writable = true

const getStore = () => (store ??= createStore('fluxo', 'kv'))

// Clone puro: nunca grava proxy reativo no IndexedDB
const plain = (value) => JSON.parse(JSON.stringify(toRaw(value)))

function checkSchema() {
  schemaChecked ??= (async () => {
    try {
      const stored = await get(KEYS.schema, getStore())
      if (stored !== undefined && stored !== SCHEMA_VERSION) {
        // migrações virão depois: não carrega nem sobrescreve dados de outra versão
        console.warn(`[fluxo] schema salvo (${stored}) difere de ${SCHEMA_VERSION}; dados locais ignorados.`)
        writable = false
        return false
      }
      return true
    } catch (err) {
      console.warn('[fluxo] IndexedDB indisponível; seguindo só em memória.', err)
      writable = false
      return false
    }
  })()
  return schemaChecked
}

/** Retorna o valor salvo ou undefined (também em caso de falha/schema divergente). */
export async function load(key) {
  if (!(await checkSchema())) return undefined
  try {
    return await get(key, getStore())
  } catch (err) {
    console.warn(`[fluxo] falha ao ler "${key}"; seguindo só em memória.`, err)
    return undefined
  }
}

export async function save(key, value) {
  if (!(await checkSchema()) || !writable) return
  try {
    const s = getStore()
    await set(KEYS.schema, SCHEMA_VERSION, s)
    await set(key, plain(value), s)
  } catch (err) {
    console.warn(`[fluxo] falha ao salvar "${key}"; seguindo só em memória.`, err)
  }
}

export async function clearAll() {
  try {
    await clear(getStore())
  } catch (err) {
    console.warn('[fluxo] falha ao limpar o armazenamento local.', err)
  }
}

/** Debounce simples para os watchers das stores. `flush()` salva já o que estiver pendente. */
export function debounced(fn, ms = 300) {
  let timer = null
  const run = () => { timer = null; return fn() }
  const call = () => { clearTimeout(timer); timer = setTimeout(run, ms) }
  call.flush = () => { clearTimeout(timer); return run() }
  return call
}
