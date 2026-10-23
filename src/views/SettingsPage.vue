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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore.js'
import { refreshOwnTransfers } from '@/modules/transfers/transferService.js'

const settings = useSettingsStore()
const draft = ref('')
const status = ref('')

const resumo = (n) => (n === 0 ? 'Nenhum lançamento mudou.' : `${n} ${n === 1 ? 'lançamento reavaliado' : 'lançamentos reavaliados'}.`)

async function add() {
  const added = await settings.addHolderName(draft.value)
  draft.value = ''
  status.value = added ? `Nome adicionado. ${resumo(await refreshOwnTransfers())}` : 'Esse nome já está na lista.'
}

async function remove(name) {
  await settings.removeHolderName(name)
  status.value = `Nome removido. ${resumo(await refreshOwnTransfers())}`
}
</script>
