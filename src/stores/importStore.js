import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImportStore = defineStore('import', () => {
  const history = ref([])
  const activeVersion = ref(null)

  function addImport(record) {
    history.value.unshift({ ...record, id: Date.now(), importedAt: new Date().toISOString() })
    activeVersion.value = history.value[0]
  }

  function removeImport(id) {
    history.value = history.value.filter(r => r.id !== id)
    if (activeVersion.value?.id === id) {
      activeVersion.value = history.value[0] || null
    }
  }

  return { history, activeVersion, addImport, removeImport }
})
