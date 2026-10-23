import Papa from 'papaparse'

/** Lê um CSV em UTF-8 (BOM removido; delimitador "," ";" ou tab detectado; aspas tratadas). */
export async function readCsv(file) {
  const text = (await file.text()).replace(/^﻿/, '')
  const { data } = Papa.parse(text, { skipEmptyLines: 'greedy', delimitersToGuess: [',', ';', '\t'] })
  const [headers = [], ...rows] = data
  return { headers: headers.map(h => String(h ?? '').trim()), rows }
}

/**
 * Número em formato BR ou internacional: "1.234,56", "69,99", "-25.90", "1234.56", "- 139,98", "R$ 10,00".
 * O último separador (, ou .) é o decimal quando há os dois; com um só tipo, vírgula é sempre decimal e
 * ponto é decimal se aparecer uma vez (vários pontos = milhar). Inválido → NaN.
 */
export function parseBrNumber(input) {
  if (typeof input === 'number') return input
  let s = String(input ?? '').replace(/R\$/gi, '').replace(/\s+/g, '')
  const negative = s.startsWith('-')
  if (negative || s.startsWith('+')) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    s = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma >= 0) {
    if (s.indexOf(',') !== lastComma) return NaN // vários separadores iguais sem decimal
    s = s.replace(',', '.')
  } else if (lastDot >= 0 && s.indexOf('.') !== lastDot) {
    s = s.split('.').join('') // 1.234.567
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN
  const n = parseFloat(s)
  return negative ? -n : n
}
