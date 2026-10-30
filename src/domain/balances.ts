import type { Account, Transaction } from '../db/types'

/**
 * Hesap bakiyeleri (kuruş). Sadece tarihi `today` veya öncesi olan işlemler sayılır.
 * Gelir +, gider −, transfer kaynaktan −, hedefe +.
 */
export function computeBalances(
  accounts: Pick<Account, 'id' | 'openingBalance'>[],
  txs: Pick<Transaction, 'type' | 'amount' | 'date' | 'accountId' | 'toAccountId'>[],
  today: string,
): Record<string, number> {
  const bal: Record<string, number> = {}
  for (const a of accounts) bal[a.id] = a.openingBalance
  for (const t of txs) {
    if (t.date > today) continue
    if (t.type === 'income') bal[t.accountId] = (bal[t.accountId] ?? 0) + t.amount
    else if (t.type === 'expense') bal[t.accountId] = (bal[t.accountId] ?? 0) - t.amount
    else {
      bal[t.accountId] = (bal[t.accountId] ?? 0) - t.amount
      if (t.toAccountId) bal[t.toAccountId] = (bal[t.toAccountId] ?? 0) + t.amount
    }
  }
  return bal
}

/**
 * Hesabın `asOf` tarihindeki bakiyesi `target` olsun diye gereken yeni açılış bakiyesi.
 * Fark açılış bakiyesine yazılır; gelir/gider raporlarını etkilemez.
 */
export function adjustedOpeningBalance(
  account: Pick<Account, 'id' | 'openingBalance'>,
  txs: Pick<Transaction, 'type' | 'amount' | 'date' | 'accountId' | 'toAccountId'>[],
  asOf: string,
  target: number,
): { current: number; openingBalance: number } {
  const current = computeBalances([account], txs, asOf)[account.id] ?? account.openingBalance
  return { current, openingBalance: account.openingBalance + (target - current) }
}
