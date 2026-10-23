<template>
  <BottomSheet :open="open" title="Alterar categoria" :subtitle="shortDescription(entry.description)" @close="close">
    <!-- 1) escolher a categoria (catálogo filtrado pelo tipo do lançamento, mais "Não é gasto" e "Nova categoria") -->
    <div v-if="step === 'pick'" data-testid="category-picker">
      <CategoryPicker ref="picker" :type="entry.type" :selected="entry.category || ''" prefix="category" show-current @pick="choose" />
    </div>

    <!-- 2) ensinar: usar sempre essa categoria para descrições parecidas? -->
    <div v-else data-testid="category-rule" class="space-y-4">
      <p class="text-sm text-slate-200">
        Categoria <span class="font-semibold text-white" data-testid="category-chosen">{{ chosen }}</span> definida para este lançamento.
      </p>
      <div>
        <label for="rule-pattern" class="mb-1 block text-sm text-slate-300">Usar sempre para lançamentos com:</label>
        <input
          id="rule-pattern"
          v-model="pattern"
          type="text"
          data-testid="rule-pattern"
          autocomplete="off"
          class="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-brand-500 focus:outline-none"
        />
        <p class="mt-1 text-xs text-slate-500">Vale para toda descrição que contenha este texto (sem acento e sem maiúsculas).</p>
      </div>
      <p data-testid="rule-impact" class="text-sm" :class="impact > 0 ? 'text-emerald-300' : 'text-slate-400'">{{ impactLabel }}</p>
      <div class="flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" data-testid="rule-create" :disabled="!normalizedPattern || saving"
          class="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
          @click="createRule">Criar regra</button>
        <button type="button" data-testid="rule-only-this" :disabled="saving"
          class="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
          @click="close">Só este</button>
      </div>
    </div>
  </BottomSheet>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import CategoryPicker from '@/components/lancamentos/CategoryPicker.vue'
import { useFinanceStore } from '@/stores/financeStore.js'
import { useRulesStore } from '@/stores/rulesStore.js'
import { isTransferCategory } from '@/modules/categories/catalog.js'
import { normalizeForMatch, countChanges } from '@/modules/categories/rules.js'
import { shortDescription } from '@/utils/description.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  entry: { type: Object, required: true }
})
const emit = defineEmits(['close'])

const financeStore = useFinanceStore()
const rulesStore = useRulesStore()

const step = ref('pick') // 'pick' | 'rule'
const chosen = ref('')
const pattern = ref('')
const saving = ref(false)
const picker = ref(null)

// a cada abertura volta para a escolha
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  step.value = 'pick'
  chosen.value = ''
  saving.value = false
  await nextTick()
  picker.value?.reset()
})

async function choose(name) {
  await financeStore.setEntryCategory(props.entry.id, name) // este lançamento vira 'manual' já
  chosen.value = name
  pattern.value = normalizeForMatch(props.entry.description)
  step.value = 'rule'
}

const normalizedPattern = computed(() => normalizeForMatch(pattern.value))

// prévia ao vivo: quantos lançamentos existentes a nova regra atualizaria
const impact = computed(() => {
  if (step.value !== 'rule' || !normalizedPattern.value) return 0
  const rule = { id: 'preview', pattern: normalizedPattern.value, category: chosen.value, origin: 'user', createdAt: '', ...(isTransferCategory(chosen.value) ? { action: 'transfer' } : {}) }
  return countChanges(financeStore.entries, [...rulesStore.rules, rule])
})
const impactLabel = computed(() => {
  if (!normalizedPattern.value) return 'Digite o texto da regra.'
  if (impact.value === 0) return 'Nenhum outro lançamento existente será atualizado'
  return `${impact.value} ${impact.value === 1 ? 'lançamento existente será atualizado' : 'lançamentos existentes serão atualizados'}`
})

async function createRule() {
  saving.value = true
  await rulesStore.addUserRule(normalizedPattern.value, chosen.value)
  await financeStore.applyRules(rulesStore.rules)
  close()
}

function close() {
  emit('close')
}
</script>
