<template>
  <div class="space-y-6 pb-10 pt-14" data-testid="review-page">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Revisar</h1>
      <p data-testid="review-total" class="text-sm text-slate-300">{{ headline }}</p>
    </div>

    <!-- Saídas | Entradas -->
    <div role="tablist" aria-label="Tipo" class="mx-auto grid w-full max-w-xs grid-cols-2 rounded-2xl bg-white/5 p-1">
      <button v-for="t in types" :key="t.id" type="button" role="tab" :data-testid="`review-filter-${t.id}`" :aria-selected="type === t.id"
        class="min-h-[44px] rounded-xl px-3 text-sm font-medium transition-colors"
        :class="type === t.id ? 'bg-brand-600/40 text-white ring-1 ring-brand-500/60' : 'text-slate-400 hover:text-white'"
        @click="type = t.id">{{ t.label }}</button>
    </div>

    <!-- Grupos -->
    <TransitionGroup v-if="groups.length" name="review" tag="ul" class="relative mx-auto max-w-2xl space-y-2" data-testid="review-list">
      <li v-for="g in groups" :key="groupId(g)" data-testid="review-group" class="glass-card flex items-stretch gap-1 overflow-hidden p-1">
        <button type="button" data-testid="review-open"
          class="min-h-[56px] min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
          @click="open(g)">
          <p class="truncate text-sm font-semibold text-white">{{ g.name }}</p>
          <p class="mt-0.5 text-xs text-slate-300"><span data-testid="review-group-summary">{{ g.count }}× · {{ formatCurrency(g.total) }}</span></p>
          <p class="mt-0.5 truncate text-[11px] text-slate-500">{{ g.months.map(monthShortLabel).join(' · ') }}</p>
        </button>
        <button type="button" data-testid="review-ignore" :aria-label="`Ignorar ${g.name}`"
          class="min-h-[44px] shrink-0 rounded-xl px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
          @click="ignore(g)">Ignorar</button>
      </li>
    </TransitionGroup>

    <div v-else data-testid="review-empty" class="glass-card mx-auto flex max-w-2xl flex-col items-center py-14 text-center">
      <span class="mb-3 text-5xl">✅</span>
      <h2 class="text-lg font-semibold text-white">Tudo categorizado</h2>
      <p class="mt-1 max-w-md text-sm text-slate-400">Não há {{ type === 'out' ? 'saídas' : 'entradas' }} sem categoria para revisar.</p>
    </div>

    <!-- Categorizar o grupo: escolher a categoria e ajustar o texto da regra -->
    <BottomSheet :open="!!active" title="Categorizar" :subtitle="active?.name || ''" @close="active = null">
      <div v-if="active" data-testid="review-sheet" class="space-y-4">
        <CategoryPicker :key="groupId(active)" :type="active.type" :selected="chosen" prefix="review-category" list-class="max-h-64 overflow-y-auto"
          selected-class="bg-brand-600/30 text-white ring-1 ring-brand-500/60" @pick="chosen = $event" />

        <div>
          <label for="review-pattern" class="mb-1 block text-sm text-slate-300">Usar sempre para lançamentos com:</label>
          <input id="review-pattern" v-model="pattern" type="text" data-testid="review-pattern" autocomplete="off"
            class="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-brand-500 focus:outline-none" />
          <p class="mt-1 text-xs text-slate-500">Um trecho menor pega mais lançamentos (sem acento e sem maiúsculas).</p>
        </div>

        <p data-testid="review-count" class="text-sm" :class="impact > 0 ? 'text-emerald-300' : 'text-slate-400'">{{ impactLabel }}</p>

        <button type="button" data-testid="review-create" :disabled="!canCreate || saving"
          class="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
          @click="create">Criar regra ({{ impact }} {{ impact === 1 ? 'lançamento' : 'lançamentos' }})</button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import CategoryPicker from '@/components/lancamentos/CategoryPicker.vue'
import { useFinanceStore } from '@/stores/financeStore.js'
import { useRulesStore } from '@/stores/rulesStore.js'
import { isTransferCategory } from '@/modules/categories/catalog.js'
import { normalizeForMatch, countChanges } from '@/modules/categories/rules.js'
import { uncategorizedGroups } from '@/modules/categories/review.js'
import { ignoredGroups, groupId } from '@/modules/categories/reviewSession.js'
import { monthShortLabel } from '@/modules/kpis/pfKpis.js'
import { formatCurrency } from '@/utils/formatters.js'

const financeStore = useFinanceStore()
const rulesStore = useRulesStore()

const types = [{ id: 'out', label: 'Saídas' }, { id: 'in', label: 'Entradas' }]
const type = ref('out')

const groups = computed(() =>
  uncategorizedGroups(financeStore.entries).filter(g => g.type === type.value && !ignoredGroups.value.includes(groupId(g))))

const headline = computed(() => {
  const count = groups.value.reduce((s, g) => s + g.count, 0)
  const total = groups.value.reduce((s, g) => s + Math.round(g.total * 100), 0) / 100
  return `${count} ${count === 1 ? 'lançamento sem categoria' : 'lançamentos sem categoria'} · ${formatCurrency(total)}`
})

function ignore(g) {
  ignoredGroups.value = [...ignoredGroups.value, groupId(g)]
}

// ─── Folha de categorização ────────────────────────────────────────────────
const active = ref(null)
const chosen = ref('')
const pattern = ref('')
const saving = ref(false)

function open(g) {
  active.value = g
  chosen.value = ''
  pattern.value = g.pattern
  saving.value = false
}
// se o grupo some da lista por outro motivo, a folha fecha
watch(groups, (list) => { if (active.value && !list.some(g => groupId(g) === groupId(active.value))) active.value = null })

const normalizedPattern = computed(() => normalizeForMatch(pattern.value))

// prévia ao vivo: quantos lançamentos a regra (com o texto atual) categorizaria
const impact = computed(() => {
  if (!active.value || !chosen.value || !normalizedPattern.value) return 0
  const rule = { id: 'preview', pattern: normalizedPattern.value, category: chosen.value, origin: 'user', createdAt: '', ...(isTransferCategory(chosen.value) ? { action: 'transfer' } : {}) }
  return countChanges(financeStore.entries, [...rulesStore.rules, rule])
})
const impactLabel = computed(() => {
  if (!chosen.value) return 'Escolha uma categoria.'
  if (!normalizedPattern.value) return 'Digite o texto da regra.'
  return `${impact.value} ${impact.value === 1 ? 'lançamento será categorizado' : 'lançamentos serão categorizados'} como ${chosen.value}${isTransferCategory(chosen.value) ? ' (sai de Entradas e Saídas)' : ''}`
})
const canCreate = computed(() => !!chosen.value && !!normalizedPattern.value && impact.value > 0)

async function create() {
  saving.value = true
  await rulesStore.addUserRule(normalizedPattern.value, chosen.value)
  await financeStore.applyRules(rulesStore.rules)
  active.value = null
}
</script>

<style scoped>
.review-enter-active, .review-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.review-enter-from, .review-leave-to { opacity: 0; transform: translateX(16px); }
.review-leave-active { position: absolute; width: 100%; max-width: 42rem; }
.review-move { transition: transform 0.2s ease; }
</style>
