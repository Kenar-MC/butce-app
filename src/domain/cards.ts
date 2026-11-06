import type { Card, CardKind } from '../db/types'
import { merchantKey } from './merchant'
import type { StatementAccount } from './importer'

/** Karşılaştırma için sade metin (Türkçe harfler sadeleşir) */
const key = (s: string | null | undefined) => merchantKey(s ?? '')
/** Banka adının ilk anlamlı kelimesi: "Garanti BBVA" → "garanti" */
const bankWord = (s: string | null | undefined) => key(s).split(' ').find((w) => w.length >= 3) ?? ''

/** Yeni kartın adı: "Garanti BBVA Bonus Platinum"; bilgi yoksa türüne göre */
export function cardNameFor(a: StatementAccount): string {
  const bank = a.bank?.trim() ?? ''
  const name = a.name?.trim() ?? ''
  if (name && bank && key(name).includes(bankWord(bank))) return name
  const joined = [bank, name].filter(Boolean).join(' ')
  if (joined && name) return joined
  if (bank) return `${bank} ${a.kind === 'bank' ? 'hesap' : 'kart'}`
  return a.kind === 'bank' ? 'Banka hesabı' : 'Kredi kartı'
}

/** Kartın görünen adı: "Garanti BBVA Bonus •• 1234" */
export function cardLabel(c: Pick<Card, 'name' | 'last4'> | undefined): string {
  if (!c) return 'Silinmiş kart'
  return c.last4 ? `${c.name} •• ${c.last4}` : c.name
}

export interface CardMatch {
  cardId?: string
  /** Eşleşen kartta son 4 hane / banka yoksa eklenecek bilgiler */
  adopt?: Partial<Pick<Card, 'last4' | 'bank'>>
}

/**
 * Ekstreyi doğru karta eşler; karıştırmamak için emin olunamazsa eşlemez (yeni kart açılır).
 * 1. Son 4 hane varsa: aynı son 4 haneli kart. Yoksa aynı bankada son 4 hanesi kayıtlı olmayan TEK uygun kart
 *    (eski kartlar) → ona son 4 hane eklenir.
 * 2. Son 4 hane yoksa: adı birebir aynı tek kart; yoksa aynı bankadaki tek uygun kart.
 */
export function matchCard(a: StatementAccount, cards: Card[]): CardMatch {
  const kindOk = (c: Card) => !a.kind || c.kind === a.kind
  const bank = bankWord(a.bank)
  const sameBank = (c: Card) => !!bank && (bankWord(c.bank) === bank || (!c.bank && key(c.name).includes(bank)))
  // Yapılandırılmış kartta (bankası kayıtlı) ad da uymalı; eski kartta (sadece ad) banka yeter
  const nameOk = (c: Card) => !a.name || !c.bank || key(c.name).includes(key(a.name))

  const adoptInfo = (c: Card): CardMatch['adopt'] => {
    const ad: CardMatch['adopt'] = {}
    if (a.last4 && !c.last4) ad.last4 = a.last4
    if (a.bank && !c.bank) ad.bank = a.bank
    return Object.keys(ad).length ? ad : undefined
  }
  const one = (list: Card[]): CardMatch => (list.length === 1 ? { cardId: list[0].id, adopt: adoptInfo(list[0]) } : {})

  if (a.last4) {
    const hit = cards.find((c) => c.last4 === a.last4 && kindOk(c))
    if (hit) return { cardId: hit.id, adopt: adoptInfo(hit) }
    return one(cards.filter((c) => !c.last4 && kindOk(c) && sameBank(c) && nameOk(c)))
  }
  const full = key(cardNameFor(a))
  const exact = cards.filter((c) => kindOk(c) && key(c.name) === full)
  if (exact.length) return one(exact)
  return one(cards.filter((c) => kindOk(c) && sameBank(c) && nameOk(c)))
}

/** Okuyucu türü söylemediyse: özet, kart ödemesi ya da taksit varsa kredi kartı */
export function guessKind(a: StatementAccount, hasCardSigns: boolean): CardKind {
  return a.kind ?? (hasCardSigns ? 'credit_card' : 'bank')
}
