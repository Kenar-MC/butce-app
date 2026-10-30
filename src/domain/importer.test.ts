import { describe, expect, it } from 'vitest'
import type { Category } from '../db/types'
import { detectKind, matchAccount, parseImportFile, planImport } from './importer'

const cat = (id: string, name: string, kind: 'expense' | 'income', archived = false): Category => ({
  id, name, kind, icon: '', color: '', archived, sortOrder: 0, createdAt: '', updatedAt: '',
})
const categories = [cat('c-market', 'Market', 'expense'), cat('c-diger', 'Diğer', 'expense'), cat('c-dgelir', 'Diğer Gelir', 'income')]
let n = 0
const base = { categories, now: '2026-10-30T00:00:00Z', newId: () => `id${++n}` }

const file = {
  app: 'butce-app', kind: 'import', version: 1, source: 'ekstre-okuyucu',
  statement: { bank: 'Garanti', period: 'Ekim 2026' },
  items: [
    { date: '2026-10-02', type: 'expense', amount: 128435, categoryName: 'market', note: 'MIGROS' },
    { date: '2026-10-08', type: 'expense', amount: 249983, categoryName: 'Elektronik', note: 'TEKNOSA', installment: { no: 3, count: 6 } },
    { date: '2026-10-15', type: 'payment', amount: 1850000, note: 'ÖDEME' },
    { date: '2026-10-20', type: 'income', amount: 5000, categoryName: 'Diğer Gelir', note: 'İADE' },
    { date: '2026-13-01', type: 'expense', amount: 100 },
    { date: '2026-10-21', type: 'expense', amount: 12.5 },
  ],
}

describe('parseImportFile', () => {
  it('geçerli satırları alır, bozukları sayar', () => {
    const f = parseImportFile(file)
    if (typeof f === 'string') throw new Error(f)
    expect(f.items).toHaveLength(4)
    expect(f.invalid).toBe(2)
    expect(f.statement?.bank).toBe('Garanti')
  })
  it('yanlış dosyayı reddeder', () => {
    expect(typeof parseImportFile({ app: 'x' })).toBe('string')
    expect(typeof parseImportFile({ ...file, version: 2 })).toBe('string')
    expect(detectKind({ app: 'butce-app', kind: 'backup' })).toBe('backup')
    expect(detectKind(null)).toBeNull()
  })
})

describe('planImport', () => {
  const items = (parseImportFile(file) as Exclude<ReturnType<typeof parseImportFile>, string>).items

  it('kategori eşler, taksiti nota ekler, ödemeyi atlar', () => {
    const p = planImport(items, { ...base, accountId: 'card', existing: [] })
    expect(p.transactions).toHaveLength(3)
    expect(p.skippedPayments).toBe(1)
    expect(p.transactions[0]).toMatchObject({ categoryId: 'c-market', accountId: 'card', type: 'expense', amount: 128435 })
    expect(p.transactions[1]).toMatchObject({ categoryId: 'c-diger', note: 'TEKNOSA (3/6)' })
    expect(p.transactions[2]).toMatchObject({ type: 'income', categoryId: 'c-dgelir' })
    expect(p.newCategories).toHaveLength(0)
  })

  it('ödemeyi kaynak hesaptan karta transfer yapar', () => {
    const p = planImport(items, { ...base, accountId: 'card', paymentCounterpartyId: 'bank', existing: [] })
    expect(p.transactions.find((t) => t.type === 'transfer')).toMatchObject({ accountId: 'bank', toAccountId: 'card', amount: 1850000 })
  })

  it('tekrarları atlar (her mevcut kayıt bir satırı eler)', () => {
    const dupItems = [items[0], items[0]]
    const existing = [{ date: '2026-10-02', type: 'expense' as const, amount: 128435, accountId: 'card' }]
    const p = planImport(dupItems, { ...base, accountId: 'card', existing })
    expect(p.skippedDuplicates).toBe(1)
    expect(p.transactions).toHaveLength(1)
  })

  it('Diğer kategorisi yoksa oluşturur', () => {
    const p = planImport([items[1], items[1]], { ...base, categories: [], accountId: 'card', existing: [] })
    expect(p.newCategories).toHaveLength(1)
    expect(p.newCategories[0].name).toBe('Diğer')
    expect(new Set(p.transactions.map((t) => t.categoryId)).size).toBe(1)
  })
})

describe('ekstre özeti', () => {
  const head = { app: 'butce-app', kind: 'import', version: 1 }
  it('sadece özet içeren dosyayı kabul eder', () => {
    const f = parseImportFile({ ...head, items: [], statement: { bank: 'Garanti' }, summary: { statementDate: '2026-10-25', dueDate: '2026-11-05', statementBalance: 1234550, minimumPayment: 246910, totalDebt: 2000000 } })
    if (typeof f === 'string') throw new Error(f)
    expect(f.items).toHaveLength(0)
    expect(f.balances).toEqual([{ label: 'Garanti kart', accountType: 'credit_card', amount: 2000000, asOf: undefined }])
    expect(f.summary).toEqual({ statementDate: '2026-10-25', dueDate: '2026-11-05', statementBalance: 1234550, minimumPayment: 246910, totalDebt: 2000000 })
  })
  it('geçersiz özet alanlarını atar; ne satır ne borç varsa reddeder', () => {
    const f = parseImportFile({ ...head, items: [], summary: { statementBalance: 12.5, totalDebt: 500, dueDate: '5 Kasım' } })
    if (typeof f === 'string') throw new Error(f)
    expect(f.summary).toEqual({ totalDebt: 500 })
    expect(typeof parseImportFile({ ...head, items: [], summary: { minimumPayment: 100 } })).toBe('string')
  })
})

describe('bakiyeler', () => {
  const head = { app: 'butce-app', kind: 'import', version: 1 }
  it('geçerli bakiye satırlarını alır', () => {
    const f = parseImportFile({ ...head, items: [], balances: [
      { label: 'Garanti Vadesiz ...1234', accountType: 'bank', amount: 4500000, asOf: '2026-10-30' },
      { label: '', accountType: 'bank', amount: 1 },
      { label: 'X', accountType: 'gold', amount: 1 },
    ] })
    if (typeof f === 'string') throw new Error(f)
    expect(f.balances).toHaveLength(1)
  })
  it('hesap eşler: ad benzerliği, yoksa türde tek hesap', () => {
    const acc = (id: string, name: string, type: string) => ({ id, name, type, archived: false })
    const accounts = [acc('a', 'Garanti Vadesiz', 'bank'), acc('b', 'Ziraat', 'bank'), acc('c', 'Bonus Kart', 'credit_card')]
    expect(matchAccount({ label: 'GARANTİ BBVA Vadesiz TL', accountType: 'bank' }, accounts)?.id).toBe('a')
    expect(matchAccount({ label: 'Yapı Kredi', accountType: 'bank' }, accounts)).toBeUndefined()
    expect(matchAccount({ label: 'Garanti kart', accountType: 'credit_card' }, accounts)?.id).toBe('c')
    expect(matchAccount({ label: 'DenizBank Black', accountType: 'credit_card' }, accounts, { singleFallback: false })).toBeUndefined()
  })
  it('banka hareketinde kart ödemesi bu hesaptan karta gider', () => {
    const items = [{ date: '2026-10-15', type: 'payment' as const, amount: 1000 }]
    const p = planImport(items, { ...base, accountId: 'bank', paymentCounterpartyId: 'card', targetIsCard: false, existing: [] })
    expect(p.transactions[0]).toMatchObject({ accountId: 'bank', toAccountId: 'card' })
  })
})

describe('gözden geçirme satırları ve taksit tarihi', () => {
  const its = [
    { date: '2026-10-02', type: 'expense' as const, amount: 1000, categoryName: 'Market', note: 'MIGROS' },
    { date: '2026-05-10', type: 'expense' as const, amount: 2000, note: 'TEKNOSA', installment: { no: 6, count: 12 } },
    { date: '2026-10-08', type: 'expense' as const, amount: 3000, note: 'MEDIAMARKT', installment: { no: 1, count: 3 } },
    { date: '2026-10-15', type: 'payment' as const, amount: 500 },
  ]
  it('her dosya satırı için bir satır döner; eski taksiti ekstre tarihine taşır', () => {
    const p = planImport(its, { ...base, accountId: 'card', statementDate: '2026-10-24', existing: [] })
    expect(p.rows).toHaveLength(4)
    expect(p.rows[1].tx).toMatchObject({ date: '2026-10-24', note: 'TEKNOSA (6/12, alış 10.05.2026)' })
    expect(p.rows[1].movedFrom).toBe('2026-05-10')
    expect(p.rows[2].tx).toMatchObject({ date: '2026-10-08', note: 'MEDIAMARKT (1/3)' })
    expect(p.rows[3].tx).toBeNull()
    expect(p.transactions).toHaveLength(3)
  })
  it('ekstre tarihi yoksa en geç taksitsiz tarihi kullanır', () => {
    const p = planImport(its, { ...base, accountId: 'card', existing: [] })
    expect(p.rows[1].tx?.date).toBe('2026-10-15')
  })
  it('tekrarı işaretler ama satırı listeden çıkarmaz', () => {
    const existing = [{ date: '2026-10-02', type: 'expense' as const, amount: 1000, accountId: 'card' }]
    const p = planImport(its, { ...base, accountId: 'card', existing })
    expect(p.rows[0].duplicate).toBe(true)
    expect(p.rows[0].tx).not.toBeNull()
    expect(p.transactions.find((t) => t.amount === 1000)).toBeUndefined()
  })
})
