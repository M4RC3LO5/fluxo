<template>
  <div class="space-y-8 pb-10 pt-14" data-testid="settings-page">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Configurações</h1>
      <p class="mx-auto max-w-2xl text-sm text-slate-400">Ajustes para o Fluxo reconhecer o que é seu.</p>
    </div>

    <section class="glass-card mx-auto max-w-2xl space-y-5 p-5 sm:p-6">
      <div>
        <h2 class="text-sm font-semibold text-white">Nome do titular</h2>
        <p class="mt-1 text-xs text-slate-400">
          Pix e transferências com o seu próprio nome, entre as suas contas, não são gasto nem receita.
          Os PDFs do Mercado Pago e do Santander acrescentam o nome sozinhos; o extrato CSV do Nubank não traz o titular,
          então adicione aqui se precisar. Basta o começo do nome (10 letras ou mais).
        </p>
      </div>

      <ul v-if="settings.holderNames.length" data-testid="holder-list" class="space-y-2">
        <li v-for="name in settings.holderNames" :key="name" data-testid="holder-name"
          class="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2">
          <span class="min-w-0 break-words text-sm font-medium text-slate-100">{{ name }}</span>
          <button type="button" data-testid="holder-remove" :aria-label="`Remover ${name}`"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-rose-400"
            @click="remove(name)">✕</button>
        </li>
      </ul>
      <p v-else data-testid="holder-empty" class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-400">Nenhum nome cadastrado ainda.</p>

      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="add">
        <input v-model="draft" type="text" data-testid="holder-input" autocomplete="off" placeholder="Nome completo do titular"
          aria-label="Nome do titular"
          class="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none" />
        <button type="submit" data-testid="holder-add" :disabled="!draft.trim()"
          class="min-h-[44px] rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40">Adicionar</button>
      </form>
      <p v-if="status" data-testid="holder-status" role="status" class="text-xs text-emerald-300">{{ status }}</p>
    </section>

    <!-- Recorrentes que o usuário marcou como "Não é recorrente" -->
    <section class="glass-card mx-auto max-w-2xl space-y-4 p-5 sm:p-6" data-testid="ignored-section">
      <div>
        <h2 class="text-sm font-semibold text-white">Recorrentes ignorados</h2>
        <p class="mt-1 text-xs text-slate-400">Itens que você marcou como “Não é recorrente” em Compromissos. Desfaça para eles voltarem à lista.</p>
      </div>
      <ul v-if="settings.ignoredRecurring.length" data-testid="ignored-list" class="space-y-2">
        <li v-for="k in settings.ignoredRecurring" :key="k" data-testid="ignored-item" class="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2">
          <span class="min-w-0 break-words font-mono text-sm text-slate-100">{{ k }}</span>
          <button type="button" data-testid="ignored-undo" :aria-label="`Voltar a considerar ${k} como recorrente`"
            class="min-h-[44px] shrink-0 rounded-lg px-3 text-xs font-semibold text-brand-300 transition-colors hover:bg-white/10"
            @click="settings.unignoreRecurring(k)">Desfazer</button>
        </li>
      </ul>
      <p v-else data-testid="ignored-empty" class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-400">Nenhum item ignorado.</p>
    </section>

    <!-- Minhas regras de categoria -->
    <section class="glass-card mx-auto max-w-2xl space-y-5 p-5 sm:p-6" data-testid="rules-section">
      <div>
        <h2 class="text-sm font-semibold text-white">Minhas regras</h2>
        <p class="mt-1 text-xs text-slate-400">
          Regras que você criou ao categorizar: toda descrição que contém o texto ganha a categoria. Remover uma regra devolve à
          situação anterior o que ela categorizou (pode ficar sem categoria); o que você escolheu à mão não muda.
        </p>
      </div>

      <ul v-if="rulesStore.userRules.length" data-testid="rules-list" class="space-y-2">
        <li v-for="rule in rulesStore.userRules" :key="rule.id" data-testid="rule-item"
          class="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-2">
          <div class="min-w-0">
            <p class="break-words text-sm text-slate-100"><span class="font-mono" data-testid="rule-pattern-text">{{ rule.pattern }}</span> <span class="text-slate-500">→</span> <span class="font-semibold" data-testid="rule-category">{{ rule.category }}</span></p>
            <p data-testid="rule-matches" class="text-xs text-slate-500">casa {{ matchCount(rule) }} {{ matchCount(rule) === 1 ? 'lançamento' : 'lançamentos' }} hoje</p>
          </div>
          <button type="button" data-testid="rule-remove" :aria-label="`Remover a regra ${rule.pattern}`"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-rose-400"
            @click="removeRule(rule)">✕</button>
        </li>
      </ul>
      <p v-else data-testid="rules-empty" class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-400">
        Você ainda não criou regras. Categorize um grupo em <router-link to="/revisar" class="font-semibold text-brand-300 underline underline-offset-2">Revisar</router-link> para criar a primeira.
      </p>
      <p v-if="ruleStatus" data-testid="rules-status" role="status" class="text-xs text-emerald-300">{{ ruleStatus }}</p>

      <div>
        <button type="button" data-testid="seed-rules-toggle" :aria-expanded="showSeeds"
          class="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
          @click="showSeeds = !showSeeds">
          <span>Regras padrão ({{ seedRules.length }})</span>
          <span aria-hidden="true">{{ showSeeds ? '▲' : '▼' }}</span>
        </button>
        <ul v-if="showSeeds" data-testid="seed-rules-list" class="mt-2 max-h-72 space-y-1 overflow-y-auto">
          <li v-for="rule in seedRules" :key="rule.id" data-testid="seed-rule-item" class="rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
            <span class="font-mono">{{ rule.pattern }}</span> <span class="text-slate-600">→</span> {{ rule.category }}
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore.js'
import { useRulesStore } from '@/stores/rulesStore.js'
import { useFinanceStore } from '@/stores/financeStore.js'
import { SEED_RULES } from '@/modules/categories/seedRules.js'
import { matchRule, isRuleEligible, compatible } from '@/modules/categories/rules.js'
import { refreshOwnTransfers } from '@/modules/transfers/transferService.js'

const settings = useSettingsStore()
const rulesStore = useRulesStore()
const financeStore = useFinanceStore()
const draft = ref('')
const status = ref('')

const resumo = (n) => (n === 0 ? 'Nenhum lançamento mudou.' : `${n} ${n === 1 ? 'lançamento reavaliado' : 'lançamentos reavaliados'}.`)

async function add() {
  const added = await settings.addHolderName(draft.value)
  draft.value = ''
  status.value = added ? `Nome adicionado. ${resumo(await refreshOwnTransfers())}` : 'Esse nome já está na lista.'
}

// ─── Minhas regras ──────────────────────────────────────────────────────────
const seedRules = SEED_RULES
const showSeeds = ref(false)
const ruleStatus = ref('')

// quantos lançamentos esta regra alcança hoje: ela é a de maior prioridade que casa, o lançamento pode receber
// regra (nem 'bank', nem 'manual', nem transferência) e a categoria é compatível com Entrada/Saída
const matches = computed(() => {
  const counts = new Map()
  for (const e of financeStore.entries) {
    if (!isRuleEligible(e)) continue
    const rule = matchRule(e, rulesStore.rules)
    if (rule?.origin === 'user' && compatible(e, rule.category)) counts.set(rule.id, (counts.get(rule.id) || 0) + 1)
  }
  return counts
})
const matchCount = (rule) => matches.value.get(rule.id) || 0

async function removeRule(rule) {
  await rulesStore.removeRule(rule.id)
  const changed = await financeStore.recalculateRules(rulesStore.rules) // o que veio dela é recalculado
  ruleStatus.value = `Regra removida. ${changed === 0 ? 'Nenhum lançamento mudou.' : `${changed} ${changed === 1 ? 'lançamento recalculado' : 'lançamentos recalculados'}.`}`
}

async function remove(name) {
  await settings.removeHolderName(name)
  status.value = `Nome removido. ${resumo(await refreshOwnTransfers())}`
}
</script>
