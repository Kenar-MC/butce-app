import { describe, expect, it } from 'vitest'
import { backupFileName, makeBackup, parseBackup } from './backup'

const data = {
  cards: [{ id: 'k1', name: 'Garanti Bonus' }],
  statements: [{ id: 's1', cardId: 'k1', month: '2026-10' }],
  transactions: [{ id: 't1', amount: 100 }],
  categories: [{ id: 'c1', name: 'Market' }],
  rules: [{ key: 'migros', categoryId: 'c1' }],
  settings: [{ key: 'lastBackupAt', value: 'x' }],
}
const req = { cards: [], statements: [], transactions: [], categories: [] }

describe('backup', () => {
  it('gidip geri gelir', () => {
    const f = makeBackup(data, '2026-10-30T12:00:00Z')
    const back = parseBackup(JSON.parse(JSON.stringify(f)))
    expect(back).toEqual(f)
    expect(backupFileName(f.exportedAt)).toBe('butce-yedek-2026-10-30.json')
  })
  it('eksik isteğe bağlı tablolar boş gelir', () => {
    const f = parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 2, data: req })
    expect(typeof f).toBe('object')
    if (typeof f === 'object') expect(f.data.rules).toEqual([])
  })
  it('bozuk ya da eski sürüm yedeği reddeder', () => {
    expect(typeof parseBackup({ app: 'butce-app', kind: 'import' })).toBe('string')
    expect(parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 1, data: req })).toMatch(/eski/)
    expect(typeof parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 2, data: { ...req, cards: [{}] } })).toBe('string')
    expect(typeof parseBackup({ app: 'butce-app', kind: 'backup', schemaVersion: 2, data: { categories: [], transactions: [] } })).toBe('string')
  })
})
