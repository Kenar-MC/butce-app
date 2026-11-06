import { describe, expect, it } from 'vitest'
import type { Category } from '../db/types'
import { defaultMonth, detectKind, monthOptions, parseImportFile, planStatement, suggestCard } from './importer'

const cat = (id: string, name: string, kind: 'expense' | 'income', archived = false): Category => ({
  id, name, kind, icon: '', color: '', archived, sortOrder: 0, createdAt: '', updatedAt: '',
})
const categories = [
  cat('c-market', 'Market', 'expense'),
  cat('c-ev', 'Ev', 'expense'),
  cat('c-diger', 'Diğer', 'expense'),
  cat('c-dgelir', 'Diğer Gelir', 'income'),
]
let n = 0
const base = { categories, rules: {}, existing: [], cardId: 'card1', month: '2026-10', now: '2026-10-30T00:00:00Z', newId: () => `id${++n}` }

const file = {
  app: 'butce-app', kind: 'import', version: 1, source: 'ekstre-okuyucu',
  statement: { bank: 'Garanti', period: 'Ekim 2026' },
  summary: { statementDate: '2026-10-14', dueDate: '2026-10-24', statementBalance: 2000000, minimumPayment: -5 },
  balances: [{ label: 'Garanti Bonus', accountType: 'credit_card', amount: 2000000 }],
  items: [
    { date: '2026-10-02', type: 'expense', amount: 128435, categoryName: 'market', note: 'MIGROS SANAL MARKET', merchant: 'Migros' },
    { date: '2026-09-28', type: 'expense', amount: 249983, categoryName: 'Elektronik', note: 'TEKNOSA ZORLU', installment: { no: 3, count: 6 } },
    { date: '2026-10-05', type: 'payment', amount: 1850000, note: 'ÖDEME' },
    { date: '2026-10-07', type: 'income', amount: 5000, categoryName: 'Diğer Gelir', note: 'IADE MIGROS' },
    { date: '2026-13-01', type: 'expense', amount: 100 },
    { date: '2026-10-21', type: 'expense', amount: 12.5 },
  ],
}

const parsed = () => {
  const f = parseImportFile(file)
  if (typeof f === 'string') throw new Error(f)
  return f
}

describe('parseImportFile', () => {
  it('geçerli satırları alır, bozukları sayar, özeti temizler', () => {
    const f = parsed()
    expect(f.items).toHaveLength(4)
    expect(f.invalid).toBe(2)
    expect(f.statement?.bank).toBe('Garanti')
    expect(f.items[0].merchant).toBe('Migros')
    expect(f.summary).toEqual({ statementDate: '2026-10-14', dueDate: '2026-10-24', statementBalance: 2000000 })
  })
  it('yanlış dosyayı reddeder', () => {
    expect(typeof parseImportFile({ app: 'x' })).toBe('string')
    expect(typeof parseImportFile({ ...file, version: 2 })).toBe('string')
    expect(detectKind({ app: 'butce-app', kind: 'backup' })).toBe('backup')
    expect(detectKind(null)).toBeNull()
  })
  it('sadece özet varsa kabul eder; ne satır ne özet varsa reddeder', () => {
    expect(typeof parseImportFile({ ...file, items: [] })).toBe('object')
    expect(parseImportFile({ ...file, items: [], summary: undefined })).toMatch(/harcama satırı yok/)
  })
})

describe('dönem', () => {
  it('kesim tarihinin ayı; yoksa tek ay; yoksa işlem tarihine göre', () => {
    const f = parsed()
    expect(defaultMonth(f)).toBe('2026-10')
    expect(defaultMonth({ items: f.items.slice(0, 1) })).toBe('2026-10')
    expect(defaultMonth({ items: f.items })).toBe('date')
    expect(monthOptions(f)).toEqual(['2026-10', '2026-09'])
  })
})

describe('planStatement', () => {
  it('kategori eşler, ödemeyi atlar, satırları seçili aya yazar', () => {
    const p = planStatement(parsed().items, base)
    expect(p.skippedPayments).toBe(1)
    expect(p.rows.map((r) => r.tx.categoryId)).toEqual(['c-market', 'c-diger', 'c-dgelir'])
    expect(p.rows.every((r) => r.tx.month === '2026-10')).toBe(true)
    expect(p.rows[1].tx.installment).toEqual({ no: 3, count: 6 })
    expect(p.rows.map((r) => r.tx.merchant)).toEqual(['Migros', 'Teknosa', 'Iade'])
  })
  it('işlem tarihine göre modunda her satır kendi ayına düşer', () => {
    const p = planStatement(parsed().items, { ...base, month: 'date' })
    expect(p.rows.map((r) => r.tx.month)).toEqual(['2026-10', '2026-09', '2026-10'])
  })
  it('işyeri kuralı okuyucunun kategorisini ezer (tür uyuyorsa)', () => {
    const p = planStatement(parsed().items, { ...base, rules: { teknosa: 'c-ev', iade: 'c-ev' } })
    expect(p.rows[1].tx.categoryId).toBe('c-ev')
    expect(p.rows[2].tx.categoryId).toBe('c-dgelir')
  })
  it('aynı karttaki tekrarı işaretler (her mevcut kayıt bir satırı)', () => {
    const existing = [{ date: '2026-10-02', type: 'expense' as const, amount: 128435, cardId: 'card1' }]
    const items = [...parsed().items.slice(0, 1), ...parsed().items.slice(0, 1)]
    expect(planStatement(items, { ...base, existing }).rows.map((r) => r.duplicate)).toEqual([true, false])
    expect(planStatement(items, { ...base, existing, cardId: 'other' }).rows.some((r) => r.duplicate)).toBe(false)
  })
  it('Diğer kategorisi yoksa oluşturur', () => {
    const p = planStatement(parsed().items.slice(1, 2), { ...base, categories: [categories[0]] })
    expect(p.newCategories).toHaveLength(1)
    expect(p.newCategories[0].name).toBe('Diğer')
    expect(p.rows[0].tx.categoryId).toBe(p.newCategories[0].id)
  })
})

describe('suggestCard', () => {
  const cards = [
    { id: 'a', name: 'DenizBank Black' },
    { id: 'b', name: 'Garanti Bonus' },
  ]
  it('banka adı geçen kartı, yoksa son kullanılanı seçer', () => {
    expect(suggestCard('Garanti BBVA', cards)).toBe('b')
    expect(suggestCard(null, cards, 'a')).toBe('a')
    expect(suggestCard('Akbank', cards)).toBeUndefined()
  })
})
