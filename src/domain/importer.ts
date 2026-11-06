import type { CardKind, Category, CategoryKind, Transaction } from '../db/types'
import { monthKey } from './dates'
import { merchantKey, resolveMerchant } from './merchant'

/**
 * Ekstre Okuyucu'nun ürettiği içe aktarma dosyası (kind: "import").
 * version 2: birden fazla ekstre, her biri kendi hesabı ve ayıyla. version 1: tek ekstre (eski okuyucu).
 * Tutarlar kuruş, tarihler YYYY-MM-DD, aylar YYYY-MM.
 */
export type ImportItemType = 'expense' | 'income' | 'payment'

export interface ImportItem {
  date: string
  type: ImportItemType
  amount: number
  categoryName?: string
  /** Ekstrede yazdığı gibi açıklama */
  note?: string
  /** Okuyucunun verdiği kısa işyeri adı */
  merchant?: string
  installment?: { no: number; count: number }
}

/** Ekstre özet sayfası; tutarlar kuruş, tarihler YYYY-MM-DD */
export interface StatementSummary {
  /** Hesap kesim tarihi */
  statementDate?: string
  /** Son ödeme tarihi */
  dueDate?: string
  /** Dönem borcu (ekstre borcu) */
  statementBalance?: number
  /** Asgari ödeme */
  minimumPayment?: number
  /** Kalan toplam / güncel borç (ödemeler ve ekstre sonrası harcamalar dahil) */
  totalDebt?: number
}

/** Ekstrenin ait olduğu kart / hesap (okuyucunun gördüğü kadarıyla) */
export interface StatementAccount {
  bank: string | null
  /** Kart / hesap ürün adı, banka adı olmadan (ör. "Bonus Platinum") */
  name: string | null
  /** Kart ya da hesap numarasının son 4 hanesi */
  last4: string | null
  kind: CardKind | null
}

export interface ParsedStatement {
  account: StatementAccount
  /** Okuyucunun belirlediği ekstre ayı */
  month?: string
  period?: string
  summary?: StatementSummary
  items: ImportItem[]
}

export interface ImportFile {
  source?: string
  statements: ParsedStatement[]
  /** Geçersiz olduğu için atlanan satır sayısı */
  invalid: number
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)
export const isMonthKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

/** Dosya türünü söyler: içe aktarma mı, yedek mi, tanınmıyor mu */
export function detectKind(json: unknown): 'import' | 'backup' | null {
  if (!isObj(json) || json.app !== 'butce-app') return null
  return json.kind === 'import' || json.kind === 'backup' ? json.kind : null
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

function parseItems(raw: unknown): { items: ImportItem[]; invalid: number } {
  const items: ImportItem[] = []
  let invalid = 0
  for (const r of Array.isArray(raw) ? raw : []) {
    if (
      !isObj(r) ||
      !isISODate(r.date) ||
      !['expense', 'income', 'payment'].includes(r.type as string) ||
      !Number.isSafeInteger(r.amount) ||
      (r.amount as number) <= 0
    ) {
      invalid++
      continue
    }
    const item: ImportItem = {
      date: r.date,
      type: r.type as ImportItemType,
      amount: r.amount as number,
      categoryName: str(r.categoryName, 60),
      note: str(r.note, 200),
      merchant: str(r.merchant, 40),
    }
    const inst = r.installment
    if (isObj(inst) && Number.isInteger(inst.no) && Number.isInteger(inst.count) && (inst.count as number) > 1) {
      item.installment = { no: inst.no as number, count: inst.count as number }
    }
    items.push(item)
  }
  return { items, invalid }
}

function parseAccount(bank: unknown, raw: unknown): StatementAccount {
  const a = isObj(raw) ? raw : {}
  const digits = typeof a.last4 === 'string' || typeof a.last4 === 'number' ? String(a.last4).replace(/\D/g, '') : ''
  return {
    bank: str(bank, 40) ?? null,
    name: str(a.name, 40) ?? null,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    kind: a.kind === 'credit_card' || a.kind === 'bank' ? a.kind : null,
  }
}

/** Doğrular; hata varsa kullanıcıya gösterilecek Türkçe mesaj döner. Bakiye satırları kullanılmaz. */
export function parseImportFile(json: unknown): ImportFile | string {
  if (detectKind(json) !== 'import' || !isObj(json)) return 'Bu bir Ekstre Okuyucu dosyası değil.'
  let raws: { bank: unknown; account: unknown; month: unknown; period: unknown; summary: unknown; items: unknown }[]
  if (json.version === 2) {
    if (!Array.isArray(json.statements)) return 'Dosyada ekstre listesi yok.'
    raws = json.statements.filter(isObj).map((st) => ({
      bank: st.bank,
      account: st.account,
      month: st.month,
      period: st.period,
      summary: st.summary,
      items: st.items,
    }))
  } else if (json.version === 1) {
    if (!Array.isArray(json.items)) return 'Dosyada işlem listesi yok.'
    const st = isObj(json.statement) ? json.statement : {}
    raws = [{ bank: st.bank, account: null, month: null, period: st.period, summary: json.summary, items: json.items }]
  } else return 'Dosya sürümü desteklenmiyor. Ekstre Okuyucu ile yeniden indir.'

  let invalid = 0
  const statements: ParsedStatement[] = []
  for (const r of raws) {
    const { items, invalid: bad } = parseItems(r.items)
    invalid += bad
    const summary = parseSummary(r.summary)
    if (!items.length && !summary) continue
    statements.push({
      account: parseAccount(r.bank, r.account),
      month: isMonthKey(r.month) ? r.month : undefined,
      period: str(r.period, 60),
      summary,
      items,
    })
  }
  if (!statements.length) return 'Dosyada harcama satırı yok. Ekstre Okuyucu\'da ekstrenin işlem sayfalarını okut.'
  return { source: typeof json.source === 'string' ? json.source : undefined, statements, invalid }
}

function parseSummary(raw: unknown): StatementSummary | undefined {
  if (!isObj(raw)) return undefined
  const s: StatementSummary = {}
  const money = (v: unknown) => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : undefined)
  if (isISODate(raw.statementDate)) s.statementDate = raw.statementDate
  if (isISODate(raw.dueDate)) s.dueDate = raw.dueDate
  s.statementBalance = money(raw.statementBalance)
  s.minimumPayment = money(raw.minimumPayment)
  s.totalDebt = money(raw.totalDebt)
  for (const k of Object.keys(s) as (keyof StatementSummary)[]) if (s[k] === undefined) delete s[k]
  return Object.keys(s).length ? s : undefined
}

const MONTHS = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik']

/** "Ekim 2026" / "01.10.2026 - 31.10.2026" → '2026-10' (birden fazlaysa sonuncusu) */
export function monthFromPeriod(text: string | undefined): string | undefined {
  if (!text) return undefined
  const t = merchantKey(text)
  let best: string | undefined
  for (const m of t.matchAll(/([a-z]+) (\d{4})/g)) {
    const i = MONTHS.indexOf(m[1])
    if (i >= 0) best = `${m[2]}-${String(i + 1).padStart(2, '0')}`
  }
  if (best) return best
  for (const m of text.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{4})/g)) {
    const mo = Number(m[2])
    if (mo >= 1 && mo <= 12) best = `${m[3]}-${String(mo).padStart(2, '0')}`
  }
  return best
}

/** Dönem seçimi: bir ay ('YYYY-MM') ya da her satır kendi tarihinin ayına */
export type MonthMode = string | 'date'

/**
 * Ekstrenin ayı: okuyucunun belirlediği ay → kesim tarihinin ayı → dönem metni → en geç satırın ayı.
 * Ekstre hep tek bir aya yazılır (karışmasın); istenirse içe aktarmada "satır tarihine göre" seçilir.
 */
export function defaultMonth(st: Pick<ParsedStatement, 'month' | 'period' | 'summary' | 'items'>): MonthMode {
  if (st.month) return st.month
  if (st.summary?.statementDate) return monthKey(st.summary.statementDate)
  const fromPeriod = monthFromPeriod(st.period)
  if (fromPeriod) return fromPeriod
  const dates = st.items.map((i) => i.date).sort()
  return dates.length ? monthKey(dates[dates.length - 1]) : 'date'
}

/** Seçilebilecek dönemler (yeniden eskiye): varsayılan ay, kesim ayı ve satırların ayları */
export function monthOptions(st: Pick<ParsedStatement, 'month' | 'period' | 'summary' | 'items'>): string[] {
  const set = new Set(st.items.map((i) => monthKey(i.date)))
  const d = defaultMonth(st)
  if (d !== 'date') set.add(d)
  if (st.summary?.statementDate) set.add(monthKey(st.summary.statementDate))
  return [...set].sort().reverse()
}

const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()

export interface PlanOptions {
  cardId: string
  month: MonthMode
  categories: Category[]
  /** merchantKey → categoryId */
  rules: Record<string, string>
  existing: Pick<Transaction, 'date' | 'type' | 'amount' | 'cardId'>[]
  now: string
  newId: () => string
}

/** Henüz ekstreye bağlanmamış satır (statementId ve importId kayıtta verilir) */
export type PlannedTx = Omit<Transaction, 'statementId' | 'importId'>

export interface PlannedRow {
  /** Dosyadaki sıra (gözden geçirme ekranında anahtar) */
  index: number
  item: ImportItem
  tx: PlannedTx
  /** Aynı kartta aynı tarih+tür+tutar ile zaten kayıtlı */
  duplicate: boolean
}

export interface StatementPlan {
  rows: PlannedRow[]
  newCategories: Category[]
  /** Kart ödemeleri harcama sayılmaz, atlanır */
  skippedPayments: number
}

const dupKey = (t: Pick<Transaction, 'date' | 'type' | 'amount' | 'cardId'>) => `${t.cardId}|${t.date}|${t.type}|${t.amount}`

/**
 * Dosya satırlarını kayda hazırlar (veritabanına yazmaz).
 * - Kart ödemeleri atlanır.
 * - Kategori: işyeri kuralı varsa o; yoksa okuyucunun kategorisi; eşleşmezse "Diğer"/"Diğer Gelir" (yoksa oluşturulur).
 * - Aynı kartta aynı tarih+tür+tutar olanlar `duplicate` (her mevcut kayıt en fazla bir satırı işaretler).
 * - Ay: seçilen dönem ya da (month = 'date') işlem tarihinin ayı.
 */
export function planStatement(items: ImportItem[], o: PlanOptions): StatementPlan {
  const rows: PlannedRow[] = []
  const newCategories: Category[] = []
  let skippedPayments = 0

  const pool = new Map<string, number>()
  for (const t of o.existing) pool.set(dupKey(t), (pool.get(dupKey(t)) ?? 0) + 1)

  const cats = [...o.categories]
  const byId = new Map(cats.map((c) => [c.id, c]))
  let nextOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1
  const findCat = (kind: CategoryKind, name: string | undefined): string => {
    const byName = (n: string) => {
      const matches = cats.filter((c) => c.kind === kind && norm(c.name) === norm(n))
      return matches.find((c) => !c.archived) ?? matches[0]
    }
    const fallback = kind === 'income' ? 'Diğer Gelir' : 'Diğer'
    const hit = (name && byName(name)) || byName(fallback)
    if (hit) return hit.id
    const created: Category = {
      id: o.newId(),
      name: fallback,
      kind,
      icon: '➕',
      color: '#94a3b8',
      archived: false,
      sortOrder: nextOrder++,
      createdAt: o.now,
      updatedAt: o.now,
    }
    cats.push(created)
    newCategories.push(created)
    return created.id
  }

  items.forEach((it, index) => {
    if (it.type === 'payment') {
      skippedPayments++
      return
    }
    const type = it.type
    const description = it.note ?? ''
    const merchant = resolveMerchant(it.merchant, description || it.categoryName || '')
    const ruled = o.rules[merchantKey(merchant)]
    const categoryId = ruled && byId.get(ruled)?.kind === type ? ruled : findCat(type, it.categoryName)

    const base = { date: it.date, type, amount: it.amount, cardId: o.cardId }
    const key = dupKey(base)
    const left = pool.get(key) ?? 0
    const duplicate = left > 0
    if (duplicate) pool.set(key, left - 1)

    rows.push({
      index,
      item: it,
      duplicate,
      tx: {
        id: o.newId(),
        ...base,
        month: o.month === 'date' ? monthKey(it.date) : o.month,
        currency: 'TRY',
        categoryId,
        description: description || merchant,
        merchant,
        installment: it.installment,
        createdAt: o.now,
        updatedAt: o.now,
      },
    })
  })

  return { rows, newCategories, skippedPayments }
}
