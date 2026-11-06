import { describe, expect, it } from 'vitest'
import { categoryTotals, categoryTrend, change, chartMonths, merchantTotals, monthlyTotals, monthsBetween, topCategoryIds } from './stats'
import { guessMerchant, merchantKey } from './merchant'

const tx = (month: string, amount: number, categoryId: string, merchant: string, type: 'expense' | 'income' = 'expense') => ({
  month, amount, categoryId, merchant, type,
})
const txs = [
  tx('2026-08', 10000, 'market', 'Migros'),
  tx('2026-09', 20000, 'market', 'Migros'),
  tx('2026-09', 5000, 'yeme', 'Starbucks'),
  tx('2026-10', 30000, 'market', 'MIGROS'),
  tx('2026-10', 15000, 'ev', 'Teknosa'),
  tx('2026-10', 5000, 'yeme', 'Starbucks'),
  tx('2026-10', 2000, 'iade', 'Migros', 'income'),
]

describe('aylar', () => {
  it('monthsBetween yıl geçişini doğru sayar', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsBetween('2026-03', '2026-02')).toEqual([])
  })
  it('chartMonths son n ayı verir, seçili ayı pencerede tutar', () => {
    expect(chartMonths(['2026-08', '2026-10'], '2026-10', 12)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(chartMonths(['2025-01', '2026-10'], '2026-10', 3)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(chartMonths(['2025-01', '2026-10'], '2025-02', 3)).toEqual(['2025-02', '2025-03', '2025-04'])
    expect(chartMonths([], '2026-10')).toEqual(['2026-10'])
  })
})

describe('toplamlar', () => {
  it('aylık gider/gelir ve gider sayısı; boş ay 0', () => {
    const m = monthlyTotals(txs, ['2026-07', '2026-10'])
    expect(m).toEqual([
      { month: '2026-07', expense: 0, income: 0, count: 0 },
      { month: '2026-10', expense: 50000, income: 2000, count: 3 },
    ])
  })
  it('kategori dağılımı payları ile, büyükten küçüğe; gelir dahil değil', () => {
    const c = categoryTotals(txs.filter((t) => t.month === '2026-10'))
    expect(c.map((x) => x.categoryId)).toEqual(['market', 'ev', 'yeme'])
    expect(c[0].share).toBeCloseTo(0.6)
    expect(topCategoryIds(txs, 2)).toEqual(['market', 'ev'])
  })
  it('işyerleri büyük/küçük harf farkı olmadan gruplanır', () => {
    const m = merchantTotals(txs)
    expect(m[0]).toEqual({ key: 'migros', name: 'Migros', amount: 60000, count: 3 })
    expect(m.map((x) => x.key)).toEqual(['migros', 'teknosa', 'starbucks'])
    expect(merchantTotals([tx('2026-10', 1, 'm', 'MIGROS'), tx('2026-10', 1, 'm', 'Migros')])).toHaveLength(1)
  })
  it('kategori trendi her ay için 0 dahil değer verir', () => {
    expect(categoryTrend(txs, ['2026-08', '2026-09', '2026-10'], ['market', 'yeme'])).toEqual([
      { month: '2026-08', values: { market: 10000, yeme: 0 } },
      { month: '2026-09', values: { market: 20000, yeme: 5000 } },
      { month: '2026-10', values: { market: 30000, yeme: 5000 } },
    ])
  })
  it('değişim oranı', () => {
    expect(change(150, 100)).toBeCloseTo(0.5)
    expect(change(100, 0)).toBeNull()
  })
})

describe('işyeri adı', () => {
  it('açıklamadan kısa ad tahmin eder', () => {
    expect(guessMerchant('MIGROS SANAL MARKET ISTANBUL TR')).toBe('Migros')
    expect(guessMerchant('IYZICO/TRENDYOL.COM')).toBe('Trendyol')
    expect(guessMerchant('4022 ŞOK MARKETLER')).toBe('Şok')
    expect(guessMerchant('')).toBe('Bilinmeyen')
  })
  it('anahtar küçük harf ve sade', () => {
    expect(merchantKey('  Kahve  Dünyası! ')).toBe('kahve dunyasi')
    expect(merchantKey('ŞOK')).toBe(merchantKey('SOK'))
    expect(merchantKey('İKEA')).toBe('ikea')
  })
})
