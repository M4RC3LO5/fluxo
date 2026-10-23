import { recurring } from './recurring.js'
import { openInstallments } from './installments.js'
import { commitmentSchedule, bankCosts } from './schedule.js'
import { latestDate } from './dates.js'

/**
 * Visão geral dos compromissos (usada pela tela e pelo card do Dashboard).
 * `ignoredKeys`: recorrentes que o usuário marcou como "Não é recorrente".
 */
export function commitmentsOverview(entries, ignoredKeys = []) {
  const asOf = latestDate(entries)
  const ignored = new Set(ignoredKeys)
  const all = recurring(entries, { asOf }).filter(r => !ignored.has(r.key))
  const active = all.filter(r => r.active)
  const inactive = all.filter(r => !r.active)
  const installments = openInstallments(entries, { asOf })
  const schedule = commitmentSchedule(installments, active, 12, asOf)
  return {
    asOf,
    recurringActive: active,
    recurringInactive: inactive,
    installments,
    schedule,
    nextMonth: schedule[0] ?? null,
    nextMonthTotal: schedule[0]?.total ?? 0,
    bank: bankCosts(entries, { asOf })
  }
}
