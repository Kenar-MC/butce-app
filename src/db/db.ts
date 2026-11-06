import Dexie, { type EntityTable } from 'dexie'
import { seed } from './seed'
import type { Card, Category, MerchantRule, Setting, Statement, Transaction } from './types'

/**
 * Ekstre sürümünün veritabanı. Eski gelir–gider sürümünün verisi ('butce-app' veritabanı)
 * olduğu gibi durur ama kullanılmaz (K11: sıfırdan başlama).
 */
export const db = new Dexie('butce-ekstre') as Dexie & {
  cards: EntityTable<Card, 'id'>
  statements: EntityTable<Statement, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  rules: EntityTable<MerchantRule, 'key'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  cards: 'id',
  statements: 'id, cardId, month, [cardId+month]',
  transactions: 'id, month, date, cardId, statementId, categoryId, importId',
  categories: 'id, kind, sortOrder',
  rules: 'key',
  settings: 'key',
})

// Veritabanı ilk kez oluşturulduğunda bir kez çalışır
db.on('populate', (tx) => seed(tx))

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
