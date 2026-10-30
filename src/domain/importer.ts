import type { Category, CategoryKind, Transaction } from '../db/types'

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

export interface ImportFile {
  source?: string
  statement?: { bank?: string | null; period?: string | null }
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
  if (!items.length) return 'Dosyada aktarılabilecek geçerli işlem yok.'
  const st = isObj(json.statement) ? json.statement : {}
  return {
    source: typeof json.source === 'string' ? json.source : undefined,
    statement: {
      bank: typeof st.bank === 'string' ? st.bank : null,
      period: typeof st.period === 'string' ? st.period : null,
    },
    items,
    invalid,
  }
}

export interface ImportOptions {
  /** İşlemlerin yazılacağı hesap (genelde kredi kartı) */
  accountId: string
  /** Kart ödemelerinin çıktığı hesap; yoksa ödemeler atlanır */
  paymentFromAccountId?: string | null
  categories: Category[]
  existing: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'toAccountId'>[]
  now: string
  newId: () => string
}

export interface ImportPlan {
  transactions: Transaction[]
  newCategories: Category[]
  skippedDuplicates: number
  skippedPayments: number
}

const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()
const dupKey = (t: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'toAccountId'>) =>
  `${t.date}|${t.type}|${t.amount}|${t.accountId}|${t.toAccountId ?? ''}`

/**
 * İçe aktarılacak kayıtları hazırlar (veritabanına yazmaz).
 * - Kategori adı eşleşmezse "Diğer"/"Diğer Gelir", o da yoksa yeni kategori.
 * - Mevcut işlemlerle aynı tarih+tür+tutar+hesap olanlar tekrar sayılır ve atlanır
 *   (her mevcut kayıt en fazla bir içe aktarma satırını eler).
 * - Kart ödemesi: kaynak hesap seçildiyse transfer (kaynak → kart), seçilmediyse atlanır.
 */
export function planImport(items: ImportItem[], o: ImportOptions): ImportPlan {
  const transactions: Transaction[] = []
  const newCategories: Category[] = []
  let skippedDuplicates = 0
  let skippedPayments = 0

  const pool = new Map<string, number>()
  for (const t of o.existing) pool.set(dupKey(t), (pool.get(dupKey(t)) ?? 0) + 1)

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

  for (const it of items) {
    let base: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'toAccountId'>
    let categoryId: string | undefined
    if (it.type === 'payment') {
      if (!o.paymentFromAccountId || o.paymentFromAccountId === o.accountId) {
        skippedPayments++
        continue
      }
      base = { date: it.date, type: 'transfer', amount: it.amount, accountId: o.paymentFromAccountId, toAccountId: o.accountId }
    } else {
      base = { date: it.date, type: it.type, amount: it.amount, accountId: o.accountId }
      categoryId = findCat(it.type, it.categoryName)
    }

    const key = dupKey(base)
    const left = pool.get(key) ?? 0
    if (left > 0) {
      pool.set(key, left - 1)
      skippedDuplicates++
      continue
    }

    const inst = it.installment ? ` (${it.installment.no}/${it.installment.count})` : ''
    const note = ((it.note ?? '') + inst).trim()
    transactions.push({
      id: o.newId(),
      ...base,
      currency: 'TRY',
      categoryId,
      note: note || undefined,
      createdAt: o.now,
      updatedAt: o.now,
    })
  }

  return { transactions, newCategories, skippedDuplicates, skippedPayments }
}
