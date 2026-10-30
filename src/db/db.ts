import Dexie, { type EntityTable } from 'dexie'
import { seed } from './seed'
import type {
  Account,
  Budget,
  Category,
  InstallmentPlan,
  RecurringRule,
  Setting,
  Transaction,
} from './types'

export const db = new Dexie('butce-app') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  installmentPlans: EntityTable<InstallmentPlan, 'id'>
  recurringRules: EntityTable<RecurringRule, 'id'>
  budgets: EntityTable<Budget, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  accounts: 'id, type, archived',
  categories: 'id, kind, archived, sortOrder',
  transactions:
    'id, date, type, accountId, toAccountId, categoryId, installmentPlanId, recurringRuleId, [recurringRuleId+date]',
  installmentPlans: 'id, accountId',
  recurringRules: 'id, active',
  budgets: 'id, &categoryId',
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
