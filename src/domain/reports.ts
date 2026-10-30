import type { Transaction } from '../db/types'

export interface Totals {
  income: number
  expense: number
  net: number
}

/** Gelir/gider toplamı; transferler dahil edilmez. */
export function totals(txs: Pick<Transaction, 'type' | 'amount'>[]): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, net: income - expense }
}
