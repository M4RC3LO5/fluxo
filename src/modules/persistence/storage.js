import { get, set, setMany, delMany, clear, createStore } from 'idb-keyval'
import { toRaw } from 'vue'

export const SCHEMA_VERSION = 3

export const KEYS = {
  schema: 'fluxo:schema',
  entries: 'fluxo:finance:entries',
  history: 'fluxo:import:history'
}

// chaves que existiam em versões antigas: lidas só pelas migrações e apagadas depois
const ACTIVE_VERSION_ID = 'fluxo:import:activeVersionId'
export const LEGACY_KEYS = [ACTIVE_VERSION_ID]

/**
 * Migrações por versão de destino, aplicadas em sequência. Cada uma recebe um objeto
 * { [chave]: valor } com todos os dados salvos e devolve o objeto migrado.
 */
export const MIGRATIONS = {
  // v1 → v2: modelo canônico (category, type 'in'/'out', source, importId).
  // Não copia center para category: no v1 não dá para saber a origem da coluna.
  2: (data) => {
    const entries = data[KEYS.entries]
    if (!Array.isArray(entries)) return data
    // no v1 'despesa' era também o valor padrão sem coluna Tipo; só 'receita' era explícito
    const type = (t) => (t === 'in' || t === 'out' ? t : t === 'receita' ? 'in' : null)
    return {
      ...data,
      [KEYS.entries]: entries.map(e => ({
        ...e,
        category: e.category ?? null,
        type: type(e.type),
        source: e.source ?? 'xlsx',
        importId: e.importId ?? null
      }))
    }
  },

  // v2 → v3: livro-caixa acumulado. Só a versão ativa guardava os lançamentos; as outras
  // versões do histórico não têm mais lançamentos e saem. Lançamentos sem importId ficam com ela.
  3: (data) => {
    const { [ACTIVE_VERSION_ID]: activeId, ...rest } = data
    const entries = rest[KEYS.entries]
    if (!Array.isArray(entries) || entries.length === 0) return { ...rest, [KEYS.history]: [] }

    const active = (Array.isArray(rest[KEYS.history]) ? rest[KEYS.history] : []).find(r => r.id === activeId)
    const record = active
      ? { id: active.id, source: active.source ?? 'xlsx', fileName: active.fileName ?? active.versionName ?? 'Importação',
          importedAt: active.importedAt ?? new Date().toISOString() }
      : { id: 'legado', source: 'xlsx', fileName: 'Dados anteriores', importedAt: new Date().toISOString() }
    return {
      ...rest,
      [KEYS.entries]: entries.map(e => ({ ...e, importId: e.importId ?? record.id })),
      [KEYS.history]: [{ ...record, count: entries.length, skipped: 0 }]
    }
  }
}

let store = null
let schemaChecked = null // Promise<boolean>: true = storage compatível
let writable = true

const getStore = () => (store ??= createStore('fluxo', 'kv'))

// Clone puro: nunca grava proxy reativo no IndexedDB
const plain = (value) => JSON.parse(JSON.stringify(toRaw(value)))

async function migrate(s, from) {
  let data = {}
  for (const key of [...Object.values(KEYS), ...LEGACY_KEYS]) {
    if (key === KEYS.schema) continue
    const value = await get(key, s)
    if (value !== undefined) data[key] = value
  }
  for (let v = from + 1; v <= SCHEMA_VERSION; v++) data = MIGRATIONS[v](data)
  // dados migrados e novo schema gravados juntos (transação única)
  await setMany([...Object.entries(data), [KEYS.schema, SCHEMA_VERSION]], s)
  await delMany(LEGACY_KEYS, s)
}

function checkSchema() {
  schemaChecked ??= (async () => {
    try {
      const s = getStore()
      const stored = await get(KEYS.schema, s)
      if (stored === undefined || stored === SCHEMA_VERSION) return true
      if (typeof stored !== 'number' || stored > SCHEMA_VERSION) {
        // salvo por versão mais nova: não carrega nem sobrescreve
        console.warn(`[fluxo] schema salvo (${stored}) difere de ${SCHEMA_VERSION}; dados locais ignorados.`)
        writable = false
        return false
      }
      try {
        await migrate(s, stored)
        return true
      } catch (err) {
        console.warn(`[fluxo] falha ao migrar schema ${stored} → ${SCHEMA_VERSION}; seguindo só em memória.`, err)
        writable = false
        return false
      }
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
