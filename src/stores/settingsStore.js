import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { normalizeText } from '@/utils/search.js'
import { categoryNameTaken, setCustomCategories } from '@/modules/categories/catalog.js'

const key = (name) => normalizeText(name).replace(/\s+/g, ' ').trim()

/**
 * Configurações do usuário, em 'fluxo:settings': { holderNames, ignoredRecurring, customCategories }.
 * holderNames: nomes do titular (transferências próprias); ignoredRecurring: chaves de comércio marcadas como "Não é recorrente";
 * customCategories: categorias próprias [{ name, kind: 'in' | 'out' }].
 */
export const useSettingsStore = defineStore('settings', () => {
  const holderNames = ref([])
  const ignoredRecurring = ref([])
  const customCategories = ref([])

  // o catálogo (findCategory, canonicalCategory, seletores) enxerga as categorias próprias na hora
  watch(customCategories, setCustomCategories, { immediate: true, deep: true, flush: 'sync' })

  const persist = debounced(() => save(KEYS.settings, { holderNames: holderNames.value, ignoredRecurring: ignoredRecurring.value, customCategories: customCategories.value }))
  watch([holderNames, ignoredRecurring, customCategories], persist, { deep: true })

  /** Adiciona um nome (sem duplicar, ignorando acento/caixa/espaços). Devolve true se entrou. Grava na hora. */
  async function addHolderName(name) {
    const clean = String(name ?? '').replace(/\s+/g, ' ').trim()
    if (!clean || holderNames.value.some(n => key(n) === key(clean))) return false
    holderNames.value = [...holderNames.value, clean]
    await persist.flush()
    return true
  }

  async function removeHolderName(name) {
    holderNames.value = holderNames.value.filter(n => key(n) !== key(name))
    await persist.flush()
  }

  /** "Não é recorrente": esconde o item da lista de recorrentes (grava na hora). */
  async function ignoreRecurring(recurringKey) {
    if (!recurringKey || ignoredRecurring.value.includes(recurringKey)) return false
    ignoredRecurring.value = [...ignoredRecurring.value, recurringKey]
    await persist.flush()
    return true
  }

  async function unignoreRecurring(recurringKey) {
    ignoredRecurring.value = ignoredRecurring.value.filter(k => k !== recurringKey)
    await persist.flush()
  }

  const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim()

  /**
   * Cria uma categoria própria do tipo 'in' | 'out'. Recusa nome vazio ou que já exista (catálogo ou próprias),
   * ignorando acento e caixa. Devolve { ok: true, name } ou { ok: false, error }. Grava na hora.
   */
  async function addCustomCategory(name, kind) {
    const clean = cleanName(name)
    if (!clean) return { ok: false, error: 'Digite um nome para a categoria.' }
    if (categoryNameTaken(clean)) return { ok: false, error: 'Já existe uma categoria com esse nome.' }
    customCategories.value = [...customCategories.value, { name: clean, kind: kind === 'in' ? 'in' : 'out' }]
    await persist.flush()
    return { ok: true, name: clean }
  }

  /** Renomeia só a lista (atualizar lançamentos e regras é do categoryService). Mesma recusa de nome repetido. */
  async function renameCustomCategory(oldName, newName) {
    const clean = cleanName(newName)
    if (!clean) return { ok: false, error: 'Digite um nome para a categoria.' }
    const current = customCategories.value.find(c => key(c.name) === key(oldName))
    if (!current) return { ok: false, error: 'Categoria não encontrada.' }
    if (key(clean) !== key(oldName) && categoryNameTaken(clean)) return { ok: false, error: 'Já existe uma categoria com esse nome.' }
    customCategories.value = customCategories.value.map(c => (c === current ? { ...c, name: clean } : c))
    await persist.flush()
    return { ok: true, name: clean }
  }

  async function removeCustomCategory(name) {
    customCategories.value = customCategories.value.filter(c => key(c.name) !== key(name))
    await persist.flush()
  }

  async function hydrate() {
    const saved = await load(KEYS.settings)
    if (Array.isArray(saved?.holderNames)) holderNames.value = saved.holderNames.filter(n => typeof n === 'string' && n.trim())
    if (Array.isArray(saved?.ignoredRecurring)) ignoredRecurring.value = saved.ignoredRecurring.filter(k => typeof k === 'string' && k)
    if (Array.isArray(saved?.customCategories)) {
      customCategories.value = saved.customCategories
        .filter(c => c && typeof c.name === 'string' && c.name.trim() && (c.kind === 'in' || c.kind === 'out'))
        .map(c => ({ name: cleanName(c.name), kind: c.kind }))
    }
  }

  return { holderNames, ignoredRecurring, customCategories, addCustomCategory, renameCustomCategory, removeCustomCategory, addHolderName, removeHolderName, ignoreRecurring, unignoreRecurring, hydrate }
})
