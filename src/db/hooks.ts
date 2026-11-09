import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Card, Category, Transaction } from './types'

const EMPTY: never[] = []

export function useCards(): Card[] {
  return useLiveQuery(async () => (await db.cards.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))) ?? EMPTY
}

export function useCategories(): Category[] {
  // Önce giderler, sonra gelirler; her grup kendi sırasında
  return (
    useLiveQuery(async () =>
      (await db.categories.toArray()).sort((a, b) => b.kind.localeCompare(a.kind) || a.sortOrder - b.sortOrder),
    ) ?? EMPTY
  )
}

/** Tüm ekstre satırları (yüklenene kadar undefined); cardId verilirse sadece o kart */
export function useTransactions(cardId = ''): Transaction[] | undefined {
  return useLiveQuery(() => (cardId ? db.transactions.where('cardId').equals(cardId).toArray() : db.transactions.toArray()), [cardId])
}

export function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]))
}

export const CARD_KINDS = {
  credit_card: { label: 'Kredi kartı', icon: '💳' },
  bank: { label: 'Banka hesabı', icon: '🏦' },
} as const

/** Kart türünün simgesi (bilinmeyen türde kart simgesi) */
export const kindIcon = (kind: string | undefined) => (kind === 'bank' ? CARD_KINDS.bank.icon : CARD_KINDS.credit_card.icon)

/** Ayarlar tablosundan tek bir değer (yüklenene kadar undefined) */
export function useSetting<T>(key: string): T | undefined {
  return useLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined, [key])
}

export const EKSTRE_OKUYUCU_URL = 'https://claude.ai/artifact/PWM5VX9xkNTK4G1v6mxFmr'
