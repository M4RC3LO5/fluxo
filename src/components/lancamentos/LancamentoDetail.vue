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
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Categoria</p>
        <p class="text-sm font-medium" :class="entry.category ? 'text-slate-200' : 'text-slate-500'">{{ entry.category || 'Sem categoria' }}</p>
      </div>
      <div class="rounded-xl bg-white/5 p-3">
        <p class="mb-1 text-xs text-slate-500">Tipo</p>
        <p class="text-sm font-medium" :class="entry.type === 'in' ? 'text-emerald-400' : entry.type === 'out' ? 'text-rose-400' : 'text-slate-500'">{{ entry.type === 'in' ? 'Entrada' : entry.type === 'out' ? 'Saída' : '—' }}</p>
      </div>
    </div>

    <div v-if="entry.notes" class="mt-3 rounded-xl bg-white/5 p-3">
      <p class="mb-1 text-xs text-slate-500">Observações</p>
      <p class="text-sm text-slate-300">{{ entry.notes }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency, formatDate, today } from '@/utils/formatters.js'

const props = defineProps({
  entry: { type: Object, required: true },
  showHeader: { type: Boolean, default: true }
})
defineEmits(['close'])

const status = computed(() => {
  const e = props.entry
  if (e.status === 'paid') return { label: 'Pago', cls: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' }
  if (e.dueDate && e.dueDate < today()) return { label: 'Vencido', cls: 'bg-rose-500/15 text-rose-400', dot: 'bg-rose-400' }
  return { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' }
})
</script>
