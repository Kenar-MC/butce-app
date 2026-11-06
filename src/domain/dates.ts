/**
 * Tarihler 'YYYY-MM-DD', aylar 'YYYY-MM' string olarak tutulur.
 * new Date('YYYY-MM-DD') UTC olarak ayrıştırıldığı için kullanılmaz.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayISO = () => toISODate(new Date())

export function parseISODate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

/** m: 1-12 */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

export const monthKey = (iso: string) => iso.slice(0, 7)

/** Ay ekler; gün yeni ayda yoksa ayın son gününe sabitler (31 Oca + 1 → 28/29 Şub) */
export function addMonths(iso: string, n: number, day?: number): string {
  const [y, m, d] = parseISODate(iso)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const nd = Math.min(day ?? d, daysInMonth(ny, nm))
  return `${ny}-${pad(nm)}-${pad(nd)}`
}

/** '2026-10' → ['2026-10-01', '2026-10-31'] */
export function monthRange(key: string): [string, string] {
  const [y, m] = key.split('-').map(Number)
  return [`${key}-01`, `${key}-${pad(daysInMonth(y, m))}`]
}

export function shiftMonth(key: string, n: number): string {
  return addMonths(`${key}-01`, n).slice(0, 7)
}

const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })

/** '2026-10' → 'Ekim 2026' */
export function formatMonthTR(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return monthFmt.format(new Date(y, m - 1, 1))
}

/** '2026-10-30' → '30 Ekim Cuma' */
const dayYearFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })

/** Gün başlığı; `currentYear` verilir ve tarih başka bir yıldaysa yıl da yazılır. */
export function formatDayTR(iso: string, currentYear?: number): string {
  const [y, m, d] = parseISODate(iso)
  const fmt = currentYear !== undefined && y !== currentYear ? dayYearFmt : dayFmt
  return fmt.format(new Date(y, m - 1, d))
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const dateYearFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

/** '2026-10-24' → '24 Ekim' (withYear: '24 Ekim 2026') */
export function formatDateTR(iso: string, withYear = false): string {
  const [y, m, d] = parseISODate(iso)
  return (withYear ? dateYearFmt : dateFmt).format(new Date(y, m - 1, d))
}
