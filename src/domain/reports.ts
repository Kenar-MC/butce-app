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

export interface CategoryTotal {
  categoryId: string
  amount: number
  count: number
}

/** Seçilen türdeki işlemleri kategoriye göre toplar, büyükten küçüğe sıralar */
export function categoryBreakdown(
  txs: Pick<Transaction, 'type' | 'amount' | 'categoryId'>[],
  type: 'expense' | 'income',
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>()
  for (const t of txs) {
    if (t.type !== type) continue
    const key = t.categoryId ?? ''
    const cur = map.get(key) ?? { categoryId: key, amount: 0, count: 0 }
    cur.amount += t.amount
    cur.count++
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}
