/**
 * Para tutarları her yerde tam sayı kuruş olarak tutulur (12550 = 125,50 ₺).
 */

/**
 * Kullanıcı girdisini kuruşa çevirir. Geçersizse null.
 * Kabul: "1.250,50" "1250,50" "1250.50" "1250" "1.250" "0,5" "₺ 1.250"
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[\s₺]/g, '')
  if (!s) return null
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // TR biçimi: nokta binlik, virgül ondalık
    if (s.lastIndexOf('.') > s.indexOf(',')) return null
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    if (!/^\d+,\d{1,2}$/.test(s)) return null
    s = s.replace(',', '.')
  } else if (hasDot) {
    // "1.250" / "1.250.000" → binlik; "1250.5" / "1250.50" → ondalık
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
    else if (!/^\d+\.\d{1,2}$/.test(s)) return null
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [int, frac = ''] = s.split('.')
  const minor = Number(int) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })

/** 125050 → "₺1.250,50" */
export function formatTRY(minor: number): string {
  return fmt.format(minor / 100)
}

/** Düzenleme formu için: 125050 → "1250,50", 125000 → "1250" */
export function toInputString(minor: number): string {
  const abs = Math.abs(minor)
  const int = Math.floor(abs / 100)
  const frac = abs % 100
  const sign = minor < 0 ? '-' : ''
  return frac ? `${sign}${int},${String(frac).padStart(2, '0')}` : `${sign}${int}`
}
