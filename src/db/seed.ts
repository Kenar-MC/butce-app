import type { Transaction as DexieTx } from 'dexie'
import { newId, nowISO } from '../lib/id'
import type { Account, Category, CategoryKind } from './types'

const EXPENSE: [string, string, string][] = [
  ['🛒', 'Market', '#10b981'],
  ['🍽️', 'Yeme-İçme', '#f97316'],
  ['🚌', 'Ulaşım', '#3b82f6'],
  ['⛽', 'Akaryakıt', '#64748b'],
  ['🏠', 'Kira', '#a855f7'],
  ['💡', 'Faturalar', '#f59e0b'],
  ['📱', 'Telefon/İnternet', '#06b6d4'],
  ['🔁', 'Abonelikler', '#6366f1'],
  ['🏥', 'Sağlık', '#ef4444'],
  ['🎓', 'Eğitim', '#0ea5e9'],
  ['👕', 'Giyim', '#ec4899'],
  ['🎉', 'Eğlence', '#d946ef'],
  ['🏋️', 'Spor', '#84cc16'],
  ['🛋️', 'Ev', '#78716c'],
  ['💈', 'Kişisel Bakım', '#14b8a6'],
  ['🎁', 'Hediye', '#f43f5e'],
  ['➕', 'Diğer', '#94a3b8'],
]

const INCOME: [string, string, string][] = [
  ['💼', 'Maaş', '#059669'],
  ['🧾', 'Serbest/Ek Gelir', '#0891b2'],
  ['🏘️', 'Kira Geliri', '#7c3aed'],
  ['📈', 'Faiz/Getiri', '#ca8a04'],
  ['➕', 'Diğer Gelir', '#94a3b8'],
]

export function defaultCategories(): Category[] {
  const now = nowISO()
  const make = (kind: CategoryKind) => ([icon, name, color]: [string, string, string], i: number): Category => ({
    id: newId(),
    name,
    kind,
    icon,
    color,
    archived: false,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  })
  return [...EXPENSE.map(make('expense')), ...INCOME.map(make('income'))]
}

export function defaultAccount(): Account {
  const now = nowISO()
  return {
    id: newId(),
    name: 'Nakit',
    type: 'cash',
    currency: 'TRY',
    openingBalance: 0,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function seed(tx: DexieTx) {
  tx.table('categories').bulkAdd(defaultCategories())
  tx.table('accounts').add(defaultAccount())
}
