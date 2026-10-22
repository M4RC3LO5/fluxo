import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'

export const useImportStore = defineStore('import', () => {
  // [{ id, source, fileName, count, skipped, importedAt }]; id = importId dos lançamentos
  const history = ref([])

  function addImport(record) {
    history.value.unshift({ ...record, importedAt: new Date().toISOString() })
  }

  const persist = debounced(() => save(KEYS.history, history.value))
  watch(history, persist, { deep: true })

  function removeImport(id) {
    history.value = history.value.filter(r => r.id !== id)
    return persist.flush()
  }

  async function hydrate() {
    const saved = await load(KEYS.history)
    if (Array.isArray(saved)) history.value = saved
  }

  return { history, addImport, removeImport, hydrate }
})
