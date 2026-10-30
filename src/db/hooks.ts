import { useLiveQuery } from 'dexie-react-hooks'
import { computeBalances } from '../domain/balances'
import { todayISO } from '../domain/dates'
import { db } from './db'
import type { Account, Category } from './types'

const EMPTY: never[] = []

export function useAccounts(): Account[] {
  return useLiveQuery(async () => (await db.accounts.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) ?? EMPTY
}

export function useCategories(): Category[] {
  // Önce giderler, sonra gelirler; her grup kendi sırasında
  return (
    useLiveQuery(async () =>
      (await db.categories.toArray()).sort((a, b) => b.kind.localeCompare(a.kind) || a.sortOrder - b.sortOrder),
    ) ?? EMPTY
  )
}

export function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]))
}

export const ACCOUNT_TYPES = {
  cash: { label: 'Nakit', icon: '💵' },
  bank: { label: 'Banka', icon: '🏦' },
  credit_card: { label: 'Kredi Kartı', icon: '💳' },
} as const

/** Hesap bakiyeleri (bugüne kadar) — işlemler değiştikçe güncellenir */
export function useBalances(accounts: Account[]): Record<string, number> {
  const txs = useLiveQuery(() => db.transactions.toArray())
  return computeBalances(accounts, txs ?? EMPTY, todayISO())
}

/** Ayarlar tablosundan tek bir değer (yüklenene kadar undefined) */
export function useSetting<T>(key: string): T | undefined {
  return useLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined, [key])
}

export const EKSTRE_OKUYUCU_URL = 'https://claude.ai/artifact/PWM5VX9xkNTK4G1v6mxFmr'
