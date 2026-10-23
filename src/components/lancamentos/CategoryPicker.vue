<template>
  <div>
    <input
      ref="searchInput"
      v-model="query"
      type="search"
      :data-testid="`${prefix}-search`"
      placeholder="Buscar categoria"
      autocomplete="off"
      class="mb-3 min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
    />
    <p v-if="options.length === 0 && notExpense.length === 0" class="py-3 text-center text-sm text-slate-500">Nenhuma categoria encontrada.</p>
    <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2" :class="listClass">
      <li v-for="c in options" :key="c.name">
        <button
          type="button"
          :data-testid="`${prefix}-option`"
          :aria-pressed="c.name === selected"
          class="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors hover:bg-white/10"
          :class="c.name === selected ? selectedClass : 'text-slate-200'"
          @click="$emit('pick', c.name)"
        >
          <span class="text-lg" aria-hidden="true">{{ c.icon }}</span>
          <span class="min-w-0 flex-1 truncate">{{ c.name }}</span>
          <span v-if="showCurrent && c.name === selected" class="text-xs text-brand-300">atual</span>
        </button>
      </li>
    </ul>

    <!-- + Nova categoria: criada para o tipo atual (Entrada/Saída) e já escolhida -->
    <div class="mt-2">
      <button v-if="!creating" type="button" :data-testid="`${prefix}-new`"
        class="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-brand-300 transition-colors hover:bg-white/10"
        @click="startCreating">
        <span class="text-lg" aria-hidden="true">＋</span>
        <span>Nova categoria</span>
      </button>
      <form v-else class="space-y-2 rounded-xl bg-white/5 p-3" @submit.prevent="create">
        <label :for="`${prefix}-new-name`" class="block text-xs text-slate-400">Nova categoria de {{ kind === 'in' ? 'entrada' : 'saída' }}</label>
        <input :id="`${prefix}-new-name`" ref="newInput" v-model="newName" type="text" :data-testid="`${prefix}-new-name`" autocomplete="off" maxlength="40"
          class="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white focus:border-brand-500 focus:outline-none" />
        <p v-if="newError" :data-testid="`${prefix}-new-error`" role="alert" class="text-xs text-rose-300">{{ newError }}</p>
        <div class="flex gap-2">
          <button type="submit" :data-testid="`${prefix}-new-create`" :disabled="!newName.trim() || saving"
            class="min-h-[44px] flex-1 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40">Criar e escolher</button>
          <button type="button" class="min-h-[44px] rounded-xl border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5" @click="creating = false">Cancelar</button>
        </div>
      </form>
    </div>

    <!-- Não é gasto: o lançamento sai de Entradas e Saídas -->
    <div v-if="notExpense.length" class="mt-4 border-t border-white/10 pt-3" :data-testid="`${prefix}-not-expense`">
      <h3 class="mb-1 px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Não é gasto</h3>
      <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <li v-for="c in notExpense" :key="c.name">
          <button
            type="button"
            :data-testid="`${prefix}-not-expense-option`"
            :aria-pressed="c.name === selected"
            class="flex min-h-[44px] w-full flex-col justify-center rounded-xl px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/10"
            :class="c.name === selected ? selectedClass : 'text-slate-200'"
            @click="$emit('pick', c.name)"
          >
            <span class="flex items-center gap-3">
              <span class="text-lg" aria-hidden="true">{{ c.icon }}</span>
              <span class="min-w-0 flex-1 truncate">{{ c.name }}</span>
              <span v-if="showCurrent && c.name === selected" class="text-xs text-brand-300">atual</span>
            </span>
            <span v-if="help[c.name]" class="ml-9 text-[11px] text-slate-500">{{ help[c.name] }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { categoriesFor, notExpenseCategories, NOT_EXPENSE_HELP } from '@/modules/categories/catalog.js'
import { useSettingsStore } from '@/stores/settingsStore.js'
import { normalizeText } from '@/utils/search.js'

const props = defineProps({
  type: { type: String, default: null }, // 'in' | 'out' | null
  selected: { type: String, default: '' },
  prefix: { type: String, default: 'category' },
  listClass: { type: String, default: '' },
  selectedClass: { type: String, default: 'bg-brand-600/20 text-white' },
  showCurrent: { type: Boolean, default: false }
})
const emit = defineEmits(['pick'])

const settings = useSettingsStore()
const help = NOT_EXPENSE_HELP
const query = ref('')
const searchInput = ref(null)
const newInput = ref(null)

const matchesQuery = (c) => { const q = normalizeText(query.value).trim(); return !q || normalizeText(c.name).includes(q) }
const options = computed(() => categoriesFor(props.type).filter(matchesQuery))
const notExpense = computed(() => notExpenseCategories().filter(matchesQuery))

// ─── Nova categoria ─────────────────────────────────────────────────────────
const kind = computed(() => (props.type === 'in' ? 'in' : 'out'))
const creating = ref(false)
const newName = ref('')
const newError = ref('')
const saving = ref(false)

async function startCreating() {
  creating.value = true
  newName.value = query.value.trim() // o que foi buscado e não existe vira o nome sugerido
  newError.value = ''
  await nextTick()
  newInput.value?.focus()
}

async function create() {
  if (saving.value) return
  saving.value = true
  const result = await settings.addCustomCategory(newName.value, kind.value)
  saving.value = false
  if (!result.ok) { newError.value = result.error; return }
  creating.value = false
  emit('pick', result.name)
}

/** A cada abertura da folha: limpa a busca e o formulário e foca a busca. */
async function reset() {
  query.value = ''
  creating.value = false
  newName.value = ''
  newError.value = ''
  saving.value = false
  await nextTick()
  searchInput.value?.focus()
}
defineExpose({ reset })
</script>
