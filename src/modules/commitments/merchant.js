import { normalizeForMatch } from '@/modules/categories/rules.js'
import { shortDescription } from '@/utils/description.js'

// intermediadores de pagamento que aparecem antes do nome do comércio (já na forma normalizada)
const PREFIXES = ['dl*', 'dl *', 'ifd*', 'ifd *', 'ebn*', 'ebn *', 'mp *', 'pg *', 'ec *', 'bmb *', 'jim.com*', 'amazonmktplc*', 'stb*', 'vmt*', 'cappta *']

// IOF de "Comércio": o IOF pertence ao comércio entre aspas
const IOF_OF = /^\s*iof de\s+["“'](.+?)["”']\s*$/i

/** Chave do comércio: descrição normalizada, sem parcela, sem trecho sensível e sem prefixo de intermediador. */
export function merchantKey(description) {
  const text = String(description ?? '')
  const iof = IOF_OF.exec(text)
  if (iof) return merchantKey(iof[1])

  let key = normalizeForMatch(shortDescription(text))
  for (let stripped = true; stripped;) {
    stripped = false
    for (const prefix of PREFIXES) {
      if (key.startsWith(prefix)) {
        key = key.slice(prefix.length).trim()
        stripped = true
      }
    }
  }
  return key
}

/** O lançamento é o IOF de um comércio (IOF de "X")? */
export const isMerchantIof = (entry) => IOF_OF.test(String(entry.description ?? ''))
