import type { Card, Category, CategoryKind, Transaction } from '../db/types'
import { monthKey } from './dates'
import { merchantKey, resolveMerchant } from './merchant'

/**
 * Ekstre Okuyucu'nun ürettiği içe aktarma dosyası (kind: "import", version 1).
 * Tutarlar kuruş, tarihler YYYY-MM-DD.
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

export interface ImportFile {
  source?: string
  statement?: { bank?: string | null; period?: string | null }
  summary?: StatementSummary
  items: ImportItem[]
  /** Geçersiz olduğu için atlanan satır sayısı */
  invalid: number
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isISODate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)

/** Dosya türünü söyler: içe aktarma mı, yedek mi, tanınmıyor mu */
export function detectKind(json: unknown): 'import' | 'backup' | null {
  if (!isObj(json) || json.app !== 'butce-app') return null
  return json.kind === 'import' || json.kind === 'backup' ? json.kind : null
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/** Doğrular; hata varsa kullanıcıya gösterilecek Türkçe mesaj döner. Bakiye satırları kullanılmaz. */
export function parseImportFile(json: unknown): ImportFile | string {
  if (detectKind(json) !== 'import' || !isObj(json)) return 'Bu bir Ekstre Okuyucu dosyası değil.'
  if (json.version !== 1) return 'Dosya sürümü desteklenmiyor. Ekstre Okuyucu ile yeniden indir.'
  if (!Array.isArray(json.items)) return 'Dosyada işlem listesi yok.'

  const items: ImportItem[] = []
  let invalid = 0
  for (const raw of json.items) {
    if (
      !isObj(raw) ||
      !isISODate(raw.date) ||
      !['expense', 'income', 'payment'].includes(raw.type as string) ||
      !Number.isSafeInteger(raw.amount) ||
      (raw.amount as number) <= 0
    ) {
      invalid++
      continue
    }
    const item: ImportItem = {
      date: raw.date,
      type: raw.type as ImportItemType,
      amount: raw.amount as number,
      categoryName: str(raw.categoryName, 60),
      note: str(raw.note, 200),
      merchant: str(raw.merchant, 40),
    }
    const inst = raw.installment
    if (isObj(inst) && Number.isInteger(inst.no) && Number.isInteger(inst.count) && (inst.count as number) > 1) {
      item.installment = { no: inst.no as number, count: inst.count as number }
    }
    items.push(item)
  }
  const summary = parseSummary(json.summary)
  const st = isObj(json.statement) ? json.statement : {}
  if (!items.length && !summary) {
    return 'Dosyada harcama satırı yok. Ekstre Okuyucu\'da ekstrenin işlem sayfalarını okut.'
  }
  return {
    source: typeof json.source === 'string' ? json.source : undefined,
    statement: {
      bank: typeof st.bank === 'string' ? st.bank : null,
      period: typeof st.period === 'string' ? st.period : null,
    },
    summary,
    items,
    invalid,
  }
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

const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()

/**
 * Dosyaya en uygun kart: banka adı kart adında geçiyorsa o, yoksa son kullanılan kart.
 */
export function suggestCard(bank: string | null | undefined, cards: Pick<Card, 'id' | 'name'>[], lastCardId?: string): string | undefined {
  const words = norm(bank ?? '').split(/[^\p{L}\d]+/u).filter((w) => w.length >= 3)
  const hit = words.length ? cards.find((c) => words.some((w) => norm(c.name).includes(w))) : undefined
  return hit?.id ?? cards.find((c) => c.id === lastCardId)?.id
}

/** Dönem seçimi: bir ay ('YYYY-MM') ya da her satır kendi tarihinin ayına */
export type MonthMode = string | 'date'

/** Varsayılan dönem: kesim tarihi varsa onun ayı, yoksa satırların tek bir ayda olması halinde o ay */
export function defaultMonth(file: Pick<ImportFile, 'summary' | 'items'>): MonthMode {
  if (file.summary?.statementDate) return monthKey(file.summary.statementDate)
  const months = new Set(file.items.map((i) => monthKey(i.date)))
  return months.size === 1 ? [...months][0] : 'date'
}

/** Seçilebilecek dönemler: satırların ve kesim tarihinin ayları (yeniden eskiye) */
export function monthOptions(file: Pick<ImportFile, 'summary' | 'items'>): string[] {
  const set = new Set(file.items.map((i) => monthKey(i.date)))
  if (file.summary?.statementDate) set.add(monthKey(file.summary.statementDate))
  return [...set].sort().reverse()
}

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
