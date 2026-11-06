import type { Transaction } from '../db/types'
import { shiftMonth } from './dates'
import { merchantKey } from './merchant'

/**
 * Ekstre istatistikleri. Harcama = gider satırları; iade/gelen para ayrı tutulur
 * (maaş gibi gelirler harcamadan düşülmesin diye net hesaplanmaz).
 */
type Tx = Pick<Transaction, 'month' | 'type' | 'amount' | 'categoryId' | 'merchant'>

/** from..to dahil ay listesi ('YYYY-MM'); from > to ise boş */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = from; m <= to && out.length < 600; m = shiftMonth(m, 1)) out.push(m)
  return out
}

export interface MonthTotal {
  month: string
  expense: number
  income: number
  count: number
}

export function monthlyTotals(txs: Tx[], months: string[]): MonthTotal[] {
  const map = new Map(months.map((m) => [m, { month: m, expense: 0, income: 0, count: 0 }]))
  for (const t of txs) {
    const cur = map.get(t.month)
    if (!cur) continue
    if (t.type === 'expense') {
      cur.expense += t.amount
      cur.count++
    } else cur.income += t.amount
  }
  return [...map.values()]
}

/**
 * Grafik ekseni: verinin olduğu aylardan en fazla `n` ay, son veri ayıyla biter.
 * Seçili ay pencerenin dışındaysa pencere onu içerecek şekilde kayar.
 */
export function chartMonths(dataMonths: string[], selected: string, n = 12): string[] {
  const all = [...dataMonths, selected].sort()
  const first = all[0]
  const last = all[all.length - 1]
  let start = shiftMonth(last, -(n - 1))
  if (start < first) start = first
  if (selected < start) start = selected
  const cap = shiftMonth(start, n - 1)
  return monthsBetween(start, cap < last ? cap : last)
}

export interface CategoryTotal {
  categoryId: string
  amount: number
  count: number
  /** 0–1 */
  share: number
}

/** Gider satırlarını kategoriye göre toplar, büyükten küçüğe */
export function categoryTotals(txs: Tx[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>()
  let total = 0
  for (const t of txs) {
    if (t.type !== 'expense') continue
    total += t.amount
    const cur = map.get(t.categoryId) ?? { categoryId: t.categoryId, amount: 0, count: 0, share: 0 }
    cur.amount += t.amount
    cur.count++
    map.set(t.categoryId, cur)
  }
  return [...map.values()]
    .map((c) => ({ ...c, share: total ? c.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
}

export interface MerchantTotal {
  key: string
  /** En sık geçen yazılış */
  name: string
  amount: number
  count: number
}

/** Gider satırlarını işyerine göre toplar, büyükten küçüğe */
export function merchantTotals(txs: Tx[]): MerchantTotal[] {
  const map = new Map<string, MerchantTotal & { names: Map<string, number> }>()
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const key = merchantKey(t.merchant) || '?'
    const cur = map.get(key) ?? { key, name: t.merchant, amount: 0, count: 0, names: new Map() }
    cur.amount += t.amount
    cur.count++
    cur.names.set(t.merchant, (cur.names.get(t.merchant) ?? 0) + 1)
    map.set(key, cur)
  }
  return [...map.values()]
    .map(({ names, ...m }) => ({ ...m, name: [...names.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
}

/** Seçilen aylarda en çok harcanan kategoriler (en fazla n) */
export function topCategoryIds(txs: Tx[], n: number): string[] {
  return categoryTotals(txs)
    .slice(0, n)
    .map((c) => c.categoryId)
}

export interface TrendRow {
  month: string
  /** categoryId → harcama (kuruş) */
  values: Record<string, number>
}

/** Her ay için verilen kategorilerin harcaması (veri yoksa 0) */
export function categoryTrend(txs: Tx[], months: string[], categoryIds: string[]): TrendRow[] {
  const ids = new Set(categoryIds)
  const rows = new Map(months.map((m) => [m, { month: m, values: Object.fromEntries(categoryIds.map((id) => [id, 0])) }]))
  for (const t of txs) {
    if (t.type !== 'expense' || !ids.has(t.categoryId)) continue
    const row = rows.get(t.month)
    if (row) row.values[t.categoryId] += t.amount
  }
  return [...rows.values()]
}

/** Yüzde değişim (önceki 0 ise null) — 0,25 = %25 artış */
export function change(cur: number, prev: number): number | null {
  return prev ? (cur - prev) / prev : null
}
