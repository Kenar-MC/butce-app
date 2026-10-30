import { describe, expect, it } from 'vitest'
import { backupFileName, makeBackup, parseBackup } from './backup'

const data = {
  accounts: [{ id: 'a1', name: 'Nakit' }],
  categories: [{ id: 'c1', name: 'Market' }],
  transactions: [{ id: 't1', amount: 100 }],
  installmentPlans: [], recurringRules: [], budgets: [],
  settings: [{ key: 'lastBackupAt', value: 'x' }],
}

describe('backup', () => {
  it('gidip geri gelir', () => {
    const f = makeBackup(data, '2026-10-30T12:00:00Z')
    const back = parseBackup(JSON.parse(JSON.stringify(f)))
    expect(back).toEqual(f)
    expect(backupFileName(f.exportedAt)).toBe('butce-yedek-2026-10-30.json')
  })
  it('eksik isteğe bağlı tablolar boş gelir', () => {
    const f = parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 1, data: { accounts: [], categories: [], transactions: [] } })
    expect(typeof f).toBe('object')
    if (typeof f === 'object') expect(f.data.budgets).toEqual([])
  })
  it('bozuk yedeği reddeder', () => {
    expect(typeof parseBackup({ app: 'butce-app', kind: 'import' })).toBe('string')
    expect(typeof parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 1, data: { accounts: [{}], categories: [], transactions: [] } })).toBe('string')
    expect(typeof parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 1, data: { categories: [], transactions: [] } })).toBe('string')
  })
})
