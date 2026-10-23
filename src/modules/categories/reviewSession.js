import { ref } from 'vue'

/** Grupos que o usuário mandou "Ignorar" na revisão: vale só nesta sessão (não grava; recarregar traz de volta). */
export const ignoredGroups = ref([])

export const groupId = (g) => `${g.type}|${g.key}`
