<template>
  <button
    type="button"
    data-testid="lanc-card"
    class="glass-card w-full min-h-[44px] space-y-2 p-4 text-left transition-colors active:bg-white/[0.06]"
    @click="$emit('open', entry)"
  >
    <div class="flex items-start justify-between gap-3">
      <p class="line-clamp-2 min-w-0 flex-1 font-medium leading-snug text-slate-100">{{ entry.description }}</p>
      <p class="shrink-0 font-mono text-base font-bold text-white">{{ formatCurrency(entry.forecast) }}</p>
    </div>
    <p class="text-xs text-slate-400">{{ formatDate(entry.dueDate) }} · {{ entry.responsible || '—' }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <span :class="status.cls" class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
        <span class="h-1.5 w-1.5 rounded-full" :class="status.dot"></span>{{ status.label }}
      </span>
      <span
        :class="entry.type === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'"
        class="rounded-lg px-2 py-1 text-xs font-medium"
      >{{ entry.type === 'receita' ? 'Receita' : 'Despesa' }}</span>
      <span v-if="entry.center" class="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-400">{{ entry.center }}</span>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency, formatDate, today } from '@/utils/formatters.js'

const props = defineProps({ entry: { type: Object, required: true } })
defineEmits(['open'])

// mesmas cores e regra de data da tabela: pago / vencido (venceu antes de hoje) / pendente
const status = computed(() => {
  const e = props.entry
  if (e.status === 'paid') return { label: 'Pago', cls: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' }
  if (e.dueDate && e.dueDate < today()) return { label: 'Vencido', cls: 'bg-rose-500/15 text-rose-400', dot: 'bg-rose-400' }
  return { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400' }
})
</script>
