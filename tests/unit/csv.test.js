import { describe, it, expect } from 'vitest'
import { parseBrNumber, readCsv } from '@/modules/importers/csv.js'

describe('parseBrNumber', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['69,99', 69.99],
    ['-25.90', -25.9],
    ['1234.56', 1234.56],
    ['- 139,98', -139.98],
    ['-1.234,56', -1234.56],
    ['R$ 10,00', 10],
    ['R$ -1.234,56', -1234.56],
    ['R$ 1.000,00', 1000],
    ['R$ -804,18', -804.18],
    ['1,234.56', 1234.56],
    ['1.234.567', 1234567],
    ['  42  ', 42],
    ['+7,5', 7.5],
    ['0', 0]
  ])('aceita "%s"', (entrada, esperado) => {
    expect(parseBrNumber(entrada)).toBeCloseTo(esperado, 2)
  })

  it.each([[''], ['   '], ['abc'], ['12abc'], ['1,2,3'], ['--5'], ['-'], [null], [undefined]])('rejeita %j', (entrada) => {
    expect(parseBrNumber(entrada)).toBeNaN()
  })

  it('aceita número já convertido', () => {
    expect(parseBrNumber(12.5)).toBe(12.5)
  })
})

describe('readCsv', () => {
  const csv = (texto, name = 'x.csv') => new File([texto], name, { type: 'text/csv' })

  it('remove BOM e detecta ;', async () => {
    const { headers, rows } = await readCsv(csv('﻿a;b\n1;2\n'))
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toEqual([['1', '2']])
  })

  it('trata aspas e vírgula dentro do campo', async () => {
    const { rows } = await readCsv(csv('a,b\n"x, y","1,5"\n'))
    expect(rows).toEqual([['x, y', '1,5']])
  })
})
