import type { Category, CategoryKind, Transaction } from '../db/types'
import { addMonths } from './dates'

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
  note?: string
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

/** Ekran görüntüsünden okunan hesap bakiyesi / kart borcu. amount hep pozitif; kartta borçtur. */
export type BalanceAccountType = 'bank' | 'credit_card' | 'cash'
export interface ImportBalance {
  label: string
  accountType: BalanceAccountType
  amount: number
  asOf?: string
}

export interface ImportFile {
  source?: string
  statement?: { bank?: string | null; period?: string | null }
  summary?: StatementSummary
  balances: ImportBalance[]
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

/** Doğrular; hata varsa kullanıcıya gösterilecek Türkçe mesaj döner */
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
      categoryName: typeof raw.categoryName === 'string' ? raw.categoryName.trim().slice(0, 60) : undefined,
      note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 200) : undefined,
    }
    const inst = raw.installment
    if (isObj(inst) && Number.isInteger(inst.no) && Number.isInteger(inst.count) && (inst.count as number) > 1) {
      item.installment = { no: inst.no as number, count: inst.count as number }
    }
    items.push(item)
  }
  const summary = parseSummary(json.summary)
  const st = isObj(json.statement) ? json.statement : {}
  const balances = parseBalances(json.balances)
  // Sadece özet varsa kart borcunu bakiye olarak ekle
  // Kalan (güncel) borç ödemeleri ve yeni harcamaları yansıttığı için önce o
  const debt = summary?.totalDebt ?? summary?.statementBalance
  if (debt !== undefined && !balances.some((b) => b.accountType === 'credit_card')) {
    balances.push({
      label: typeof st.bank === 'string' && st.bank ? `${st.bank} kart` : 'Kredi kartı',
      accountType: 'credit_card',
      amount: debt,
      // Kalan borç bugünün tutarı; sadece ekstre borcu varsa kesim tarihi
      asOf: summary?.totalDebt !== undefined ? undefined : summary?.statementDate,
    })
  }
  if (!items.length && !balances.length) return 'Dosyada aktarılabilecek işlem ya da bakiye yok.'
  return {
    source: typeof json.source === 'string' ? json.source : undefined,
    statement: {
      bank: typeof st.bank === 'string' ? st.bank : null,
      period: typeof st.period === 'string' ? st.period : null,
    },
    summary,
    balances,
    items,
    invalid,
  }
}

function parseBalances(raw: unknown): ImportBalance[] {
  if (!Array.isArray(raw)) return []
  const out: ImportBalance[] = []
  for (const b of raw) {
    if (
      !isObj(b) ||
      typeof b.label !== 'string' ||
      !b.label.trim() ||
      !['bank', 'credit_card', 'cash'].includes(b.accountType as string) ||
      !Number.isSafeInteger(b.amount) ||
      (b.amount as number) < 0
    )
      continue
    out.push({
      label: b.label.trim().slice(0, 60),
      accountType: b.accountType as BalanceAccountType,
      amount: b.amount as number,
      asOf: isISODate(b.asOf) ? b.asOf : undefined,
    })
  }
  return out
}

/** Bakiye satırı için hedef bakiye (kart borcu negatif) */
export const balanceTarget = (b: Pick<ImportBalance, 'accountType' | 'amount'>) =>
  b.accountType === 'credit_card' ? -b.amount : b.amount

/** Bakiye satırına en uygun hesabı bulur: aynı tür + ad benzerliği; tek aday varsa o */
export function matchAccount<A extends { id: string; name: string; type: string; archived: boolean }>(
  b: Pick<ImportBalance, 'label' | 'accountType'>,
  accounts: A[],
): A | undefined {
  const same = accounts.filter((a) => !a.archived && a.type === b.accountType)
  const words = norm(b.label).split(/[^\p{L}\d]+/u).filter((w) => w.length >= 3)
  const scored = same
    .map((a) => ({ a, score: words.filter((w) => norm(a.name).includes(w)).length }))
    .sort((x, y) => y.score - x.score)
  if (scored[0]?.score) return scored[0].a
  return same.length === 1 ? same[0] : undefined
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

export interface ImportOptions {
  /** İşlemlerin yazılacağı hesap (genelde kredi kartı) */
  accountId: string
  /** Kart ödemesinin karşı hesabı; yoksa ödemeler atlanır */
  paymentCounterpartyId?: string | null
  /** Hedef hesap kart mı? Kartsa ödeme karşı hesaptan karta, değilse bu hesaptan karta transferdir */
  targetIsCard?: boolean
  /** Hesap kesim tarihi: eski taksit satırları bu tarihe yazılır */
  statementDate?: string
  categories: Category[]
  existing: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'toAccountId'>[]
  now: string
  newId: () => string
}

export interface PlannedRow {
  /** Dosyadaki sıra (gözden geçirme ekranında anahtar) */
  index: number
  item: ImportItem
  /** null: kart ödemesi ve karşı hesap seçilmedi */
  tx: Transaction | null
  /** Aynı tarih+tür+tutar+hesap ile zaten kayıtlı */
  duplicate: boolean
  /** Eski taksit satırı ekstre tarihine taşındıysa ilk alış tarihi */
  movedFrom?: string
}

export interface ImportPlan {
  rows: PlannedRow[]
  /** Varsayılan seçim: tekrar olmayan ve eklenebilir satırlar */
  transactions: Transaction[]
  newCategories: Category[]
  skippedDuplicates: number
  skippedPayments: number
}

const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()
const dupKey = (t: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'toAccountId'>) =>
  `${t.date}|${t.type}|${t.amount}|${t.accountId}|${t.toAccountId ?? ''}`

const trDate = (iso: string) => iso.split('-').reverse().join('.')

/**
 * İçe aktarılacak kayıtları hazırlar (veritabanına yazmaz). Her dosya satırı için bir PlannedRow döner;
 * gözden geçirme ekranı satırları tek tek açıp kapatabilir.
 * - Kategori adı eşleşmezse "Diğer"/"Diğer Gelir", o da yoksa yeni kategori.
 * - Mevcut işlemlerle aynı tarih+tür+tutar+hesap olanlar `duplicate` işaretlenir
 *   (her mevcut kayıt en fazla bir satırı işaretler).
 * - Kart ödemesi: karşı hesap seçildiyse transfer (kart ekstresinde karşı hesap → kart,
 *   banka hareketinde bu hesap → kart), seçilmediyse `tx: null`.
 * - Taksit (2. taksit ve sonrası) ilk alış tarihiyle gelir; ekstre döneminden bir aydan eskiyse
 *   ekstre tarihine taşınır (yoksa dosyadaki en geç taksitsiz tarihe), alış tarihi nota yazılır.
 */
export function planImport(items: ImportItem[], o: ImportOptions): ImportPlan {
  const rows: PlannedRow[] = []
  const newCategories: Category[] = []
  let skippedDuplicates = 0
  let skippedPayments = 0

  const pool = new Map<string, number>()
  for (const t of o.existing) pool.set(dupKey(t), (pool.get(dupKey(t)) ?? 0) + 1)

  const plainDates = items.filter((i) => !i.installment).map((i) => i.date).sort()
  const instDate = o.statementDate ?? plainDates[plainDates.length - 1]
  const oldBefore = instDate ? addMonths(instDate, -1) : undefined

  const cats = [...o.categories]
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
    let date = it.date
    let movedFrom: string | undefined
    if (it.installment && it.installment.no > 1 && instDate && oldBefore && it.date < oldBefore) {
      movedFrom = it.date
      date = instDate
    }

    let base: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'toAccountId'>
    let categoryId: string | undefined
    if (it.type === 'payment') {
      const other = o.paymentCounterpartyId
      if (!other || other === o.accountId) {
        skippedPayments++
        rows.push({ index, item: it, tx: null, duplicate: false })
        return
      }
      const [from, to] = o.targetIsCard === false ? [o.accountId, other] : [other, o.accountId]
      base = { date, type: 'transfer', amount: it.amount, accountId: from, toAccountId: to }
    } else {
      base = { date, type: it.type, amount: it.amount, accountId: o.accountId }
      categoryId = findCat(it.type, it.categoryName)
    }

    const key = dupKey(base)
    const left = pool.get(key) ?? 0
    const duplicate = left > 0
    if (duplicate) {
      pool.set(key, left - 1)
      skippedDuplicates++
    }

    const inst = it.installment
      ? ` (${it.installment.no}/${it.installment.count}${movedFrom ? `, alış ${trDate(movedFrom)}` : ''})`
      : ''
    const note = ((it.note ?? '') + inst).trim()
    rows.push({
      index,
      item: it,
      duplicate,
      movedFrom,
      tx: {
        id: o.newId(),
        ...base,
        currency: 'TRY',
        categoryId,
        note: note || undefined,
        createdAt: o.now,
        updatedAt: o.now,
      },
    })
  })

  const transactions = rows.filter((r) => r.tx && !r.duplicate).map((r) => r.tx!)
  return { rows, transactions, newCategories, skippedDuplicates, skippedPayments }
}
