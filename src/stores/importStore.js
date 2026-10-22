import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'

export const useImportStore = defineStore('import', () => {
  const history = ref([])
  const activeVersion = ref(null)

  function addImport(record) {
    history.value.unshift({ ...record, id: Date.now(), importedAt: new Date().toISOString() })
    activeVersion.value = history.value[0]
  }

  // activeVersion é persistido só pelo id; história + id são gravados juntos
  const persist = debounced(() => Promise.all([
    save(KEYS.history, history.value),
    save(KEYS.activeVersionId, activeVersion.value?.id ?? null)
  ]))
  watch(history, persist, { deep: true })
  watch(() => activeVersion.value?.id, persist)

  function removeImport(id) {
    history.value = history.value.filter(r => r.id !== id)
    if (activeVersion.value?.id === id) {
      activeVersion.value = history.value[0] || null
    }
    return persist.flush()
  }

  async function hydrate() {
    const [savedHistory, activeId] = await Promise.all([load(KEYS.history), load(KEYS.activeVersionId)])
    if (!Array.isArray(savedHistory)) return
    history.value = savedHistory
    activeVersion.value = savedHistory.find(r => r.id === activeId) ?? null
  }

  return { history, activeVersion, addImport, removeImport, hydrate }
})
