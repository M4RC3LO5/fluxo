<template>
  <div data-testid="lanc-modal">
    <template v-if="showHeader">
      <div class="mb-5 flex items-start justify-between">
        <div class="min-w-0 flex-1 pr-3">
          <h2 class="text-lg font-semibold leading-snug text-white">{{ entry.description }}</h2>
          <p class="mt-0.5 text-sm text-slate-400">{{ formatDate(entry.dueDate) }}</p>
        </div>
        <button data-testid="lanc-modal-close" aria-label="Fechar" @click="$emit('close')" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </template>

    <div class="mb-5">
      <span :class="status.cls" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium">
        <span class="h-2 w-2 rounded-full" :class="status.dot"></span>{{ status.label }}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Valor Previsto</p>
        <p class="font-mono font-semibold text-white">{{ formatCurrency(entry.forecast) }}</p>
      </div>
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Valor Pago</p>
        <p class="font-mono font-semibold" :class="entry.paid > 0 ? 'text-emerald-400' : 'text-slate-600'">{{ entry.paid > 0 ? formatCurrency(entry.paid) : '—' }}</p>
      </div>
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Responsável</p>
        <p class="text-sm font-medium text-slate-200">{{ entry.responsible || '—' }}</p>
      </div>
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Pagador</p>
        <p class="text-sm font-medium text-slate-200">{{ entry.payer || '—' }}</p>
      </div>
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Centro de Custo</p>
        <p class="text-sm font-medium text-slate-200">{{ entry.center || '—' }}</p>
      </div>
      <!-- Categoria: editável (toque abre o catálogo); transferência não -->
      <div
        v-if="!entry.transfer"
        data-testid="category-edit"
        role="button"
        tabindex="0"
        class="cursor-pointer rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
        @click="editing = true"
        @keydown.enter.prevent="editing = true"
        @keydown.space.prevent="editing = true"
      >
        <p class="mb-1 text-xs text-slate-500">Categoria</p>
        <p class="text-sm font-medium" :class="entry.category ? 'text-slate-200' : 'text-slate-500'">{{ entry.category || 'Sem categoria' }}</p>
        <span class="mt-1 block text-[11px] text-brand-300">{{ sourceHint }}</span>
      </div>
      <div v-else data-testid="category-locked" class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Categoria</p>
        <p class="text-sm font-medium text-slate-200">{{ entry.category || 'Sem categoria' }}</p>
        <span class="mt-1 block text-[11px] text-slate-500">Transferência: a categoria não é editável nesta versão.</span>
      </div>
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Tipo</p>
        <p class="text-sm font-medium" :class="badge.text">{{ badge.label }}</p>
      </div>
      <div v-if="entry.installment" class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Parcelamento</p>
        <p class="text-sm font-medium text-slate-200">Parcela {{ entry.installment.current }} de {{ entry.installment.total }}</p>
      </div>
    </div>

    <!-- Transferência entre contas próprias: detectada por nome / pareada / marcada por você (o 'bank' não tem botões) -->
    <div v-if="transferNote" data-testid="transfer-info" class="mt-3 space-y-3 rounded-xl bg-sky-500/10 p-3">
      <p class="text-sm text-sky-200">{{ transferNote }}</p>
      <button type="button" data-testid="transfer-undo"
        class="min-h-[44px] w-full rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
        @click="undoTransfer">Não é transferência</button>
    </div>
    <div v-else-if="canMarkTransfer" class="mt-3">
      <button type="button" data-testid="transfer-mark"
        class="min-h-[44px] w-full rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
        @click="markTransfer">Marcar como transferência entre contas</button>
    </div>

    <!-- fica montado enquanto edita: escolher "Não é gasto" torna o lançamento transferência e o passo da regra ainda precisa dele -->
    <CategoryEditor v-if="!entry.transfer || editing" :open="editing" :entry="entry" @close="editing = false" />

    <div v-if="entry.notes" class="mt-3 rounded-xl bg-white/5 p-3">
      <p class="mb-1 text-xs text-slate-500">Observações</p>
      <p class="text-sm text-slate-300">{{ entry.notes }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import CategoryEditor from '@/components/lancamentos/CategoryEditor.vue'
import { categorySourceOf } from '@/modules/categories/rules.js'
import { useFinanceStore } from '@/stores/financeStore.js'
import { useRulesStore } from '@/stores/rulesStore.js'
import { hasTransferKeyword, transferSourceOf } from '@/modules/transfers/ownTransfers.js'
import { accountLabel } from '@/modules/transfers/accounts.js'
import { formatCurrency, formatDate, today } from '@/utils/formatters.js'
import { typeBadge } from '@/utils/entryType.js'

const props = defineProps({
  entry: { type: Object, required: true },
  showHeader: { type: Boolean, default: true }
})
defineEmits(['close'])

const badge = computed(() => typeBadge(props.entry))

const financeStore = useFinanceStore()
const rulesStore = useRulesStore()

// ─── Transferência entre contas próprias ────────────────────────────────────
const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const transferNote = computed(() => {
  const e = props.entry
  if (!e.transfer) return ''
  const source = transferSourceOf(e)
  if (source === 'name') return 'Transferência entre contas próprias (detectada por nome)'
  if (source === 'manual') return 'Transferência entre contas próprias (marcada por você)'
  if (source === 'rule') return 'Não é gasto (marcado por uma regra sua)'
  if (source === 'pair') {
    const partner = financeStore.entries.find(x => x.id === e.pairedWith)
    return partner
      ? `Transferência entre contas próprias (pareada com ${accountLabel(partner.account)} em ${shortDate(partner.dueDate)})`
      : 'Transferência entre contas próprias (pareada)'
  }
  return '' // 'bank': pagamento de fatura etc. — sem botões
})
const canMarkTransfer = computed(() =>
  !props.entry.transfer && (props.entry.type === 'in' || props.entry.type === 'out') && hasTransferKeyword(props.entry.description))

async function undoTransfer() {
  await financeStore.undoOwnTransfer(props.entry.id)
  await financeStore.applyRules(rulesStore.rules) // volta a ser Entrada/Saída: as regras de categoria voltam a valer
}
function markTransfer() {
  return financeStore.markOwnTransfer(props.entry.id)
}

const editing = ref(false)
const sourceHint = computed(() => {
  const source = categorySourceOf(props.entry)
  const label = source === 'manual' ? 'escolhida por você' : source === 'rule' ? 'automática (regra)' : source === 'bank' ? 'do extrato' : ''
  return label ? `Toque para alterar · ${label}` : 'Toque para escolher'
})

const status = computed(() => {
  const e = props.entry
  if (e.status === 'paid') return { label: 'Pago', cls: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' }
  if (e.dueDate && e.dueDate < today()) return { label: 'Vencido', cls: 'bg-rose-500/15 text-rose-400', dot: 'bg-rose-400' }
  return { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' }
})
</script>
