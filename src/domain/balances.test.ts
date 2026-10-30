import { describe, expect, it } from 'vitest'
import { computeBalances } from './balances'
import { totals } from './reports'

const accounts = [
  { id: 'cash', openingBalance: 10000 },
  { id: 'card', openingBalance: -50000 },
]
const txs = [
  { type: 'income' as const, amount: 5000, date: '2026-10-01', accountId: 'cash' },
  { type: 'expense' as const, amount: 2000, date: '2026-10-02', accountId: 'cash' },
  { type: 'expense' as const, amount: 30000, date: '2026-10-03', accountId: 'card' },
  { type: 'transfer' as const, amount: 4000, date: '2026-10-04', accountId: 'cash', toAccountId: 'card' },
  { type: 'expense' as const, amount: 99999, date: '2026-11-01', accountId: 'card' },
]

describe('balances', () => {
  it('bugüne kadarki işlemleri sayar', () => {
    expect(computeBalances(accounts, txs, '2026-10-30')).toEqual({ cash: 9000, card: -76000 })
  })
  it('totals transferi saymaz', () => {
    expect(totals(txs.slice(0, 4))).toEqual({ income: 5000, expense: 32000, net: -27000 })
  })
})
