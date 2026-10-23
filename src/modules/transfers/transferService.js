import { useFinanceStore } from '@/stores/financeStore.js'
import { useSettingsStore } from '@/stores/settingsStore.js'

/**
 * Reavalia as transferências entre contas próprias em TODOS os lançamentos (nome do titular + pareamento).
 * Idempotente: roda depois de cada importação, ao mudar os nomes do titular e na hidratação.
 * Só grava se algo mudou. Devolve quantos lançamentos mudaram.
 */
export function refreshOwnTransfers() {
  return useFinanceStore().applyOwnTransfers(useSettingsStore().holderNames)
}
