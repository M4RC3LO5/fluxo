/** Lê uma chave do IndexedDB do app (idb-keyval: banco "fluxo", store "kv"). */
export const idbGet = (page, key) => page.evaluate(key => new Promise((resolve, reject) => {
  const open = indexedDB.open('fluxo')
  open.onerror = () => reject(open.error)
  open.onsuccess = () => {
    const req = open.result.transaction('kv').objectStore('kv').get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }
}), key)
