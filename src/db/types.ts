export type Currency = 'TRY'
export type CardKind = 'credit_card' | 'bank'
export type TxType = 'expense' | 'income'
export type CategoryKind = 'income' | 'expense'

interface Stamped {
  createdAt: string
  updatedAt: string
}

/** Ekstresi okunan kredi kartı ya da banka hesabı */
export interface Card extends Stamped {
  id: string
  name: string
  kind: CardKind
  currency: Currency
  bank?: string
  /** Kart / hesap numarasının son 4 hanesi — ekstreler bununla doğru karta eşlenir */
  last4?: string
}

/**
 * Bir kartın bir aylık dökümü. Aynı kart + ay için tek kayıt vardır;
 * aynı ayın yeni okumaları (ör. kalan sayfalar) bu kayda eklenir.
 */
export interface Statement extends Stamped {
  id: string
  cardId: string
  /** 'YYYY-MM' */
  month: string
  currency: Currency
  bank?: string
  /** Hesap kesim tarihi */
  statementDate?: string
  /** Son ödeme tarihi */
  dueDate?: string
  /** Ekstre (dönem) borcu, kuruş */
  statementBalance?: number
  minimumPayment?: number
  /** Kalan toplam borç */
  totalDebt?: number
}

/** Ekstredeki bir harcama ya da iade/gelen para satırı */
export interface Transaction extends Stamped {
  id: string
  statementId: string
  cardId: string
  /** Sayıldığı ekstre ayı 'YYYY-MM' (kartta kesim ayı, hesapta işlem ayı) */
  month: string
  /** İşlem tarihi YYYY-MM-DD */
  date: string
  type: TxType
  /** kuruş, > 0 */
  amount: number
  currency: Currency
  categoryId: string
  /** Ekstrede yazdığı gibi */
  description: string
  /** Kısa işyeri adı (Migros, Trendyol…) — "en çok harcanan yerler" bunu gruplar */
  merchant: string
  installment?: { no: number; count: number }
  /** Hangi içe aktarmayla geldiği (geri almak için) */
  importId: string
}

export interface Category extends Stamped {
  id: string
  name: string
  kind: CategoryKind
  icon: string
  color: string
  archived: boolean
  sortOrder: number
}

/** İşyeri → kategori kuralı (kullanıcı bir işyerinin kategorisini değiştirince) */
export interface MerchantRule {
  /** merchantKey(merchant) */
  key: string
  categoryId: string
  updatedAt: string
}

export interface Setting {
  key: string
  value: unknown
}
