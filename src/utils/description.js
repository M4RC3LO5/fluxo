const SENSITIVE = /•••|ag[eê]ncia:|conta:/i

/**
 * Encurta a descrição para exibição quando ela traz CPF mascarado (•••) ou "Agência:"/"Conta:":
 * mantém só o 1º trecho + o nome (o que vem antes do primeiro trecho sensível). O texto completo fica no detalhe.
 */
export function shortDescription(description) {
  const text = String(description ?? '')
  if (!SENSITIVE.test(text)) return text
  const parts = text.split(' - ')
  const idx = parts.findIndex(p => SENSITIVE.test(p))
  return idx > 0 ? parts.slice(0, idx).join(' - ') : text
}
