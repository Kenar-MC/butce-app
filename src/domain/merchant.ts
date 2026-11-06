/**
 * İşyeri adları: "en çok harcanan yerler" listesi ve işyeri → kategori kuralları için.
 * Ekstre Okuyucu kısa adı (merchant) verir; vermezse açıklamadan tahmin edilir.
 */

/** Ödeme aracıları ve anlamsız parçalar: işyeri adı sayılmaz */
const NOISE = new Set([
  'iyzico',
  'iyz',
  'paytr',
  'param',
  'craftgate',
  'papara',
  'sipay',
  'moka',
  'ozan',
  'paycell',
  'www',
  'com',
  'net',
  'org',
  'tr',
  'tur',
  'sanal',
  'pos',
  'odeme',
  'tic',
  'ltd',
  'sti',
  'as',
  'san',
  've',
])

/** Küçük harf; ekstrelerdeki ASCII büyük "I" için Türkçe "ı"ya çevirmez (MIGROS → migros) */
const lower = (s: string) => s.replace(/İ/g, 'i').toLowerCase()

/**
 * Gruplama anahtarı: küçük harf, Türkçe karakterler sadeleşir (ŞOK = SOK), harf/rakam dışı karakterler boşluk.
 */
export function merchantKey(name: string): string {
  return lower(name)
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\d]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** "MIGROS SANAL MARKET ISTANBUL" → "Migros"; "IYZICO/TRENDYOL.COM" → "Trendyol" */
export function guessMerchant(description: string): string {
  const words = description
    .split(/[^\p{L}\d&']+/u)
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !NOISE.has(merchantKey(w)))
  const first = words[0]
  if (!first) return description.trim().slice(0, 40) || 'Bilinmeyen'
  return titleCase(first)
}

export function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (w ? w[0].toLocaleUpperCase('tr') + lower(w.slice(1)) : w))
    .join(' ')
}

/** Okuyucunun verdiği ad (varsa) ya da açıklamadan tahmin */
export function resolveMerchant(merchant: string | undefined, description: string): string {
  const m = merchant?.trim()
  return m ? m.slice(0, 40) : guessMerchant(description)
}
