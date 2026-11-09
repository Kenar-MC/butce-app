import { cardLabel } from '../domain/cards'
import type { MonthMode, PlannedTx, StatementSummary } from '../domain/importer'
import { merchantKey } from '../domain/merchant'
import { newId, nowISO } from '../lib/id'
import { db } from './db'
import type { Card, CardKind, Category, Statement, Transaction } from './types'

/** Son içe aktarma (geri almak için) */
export interface LastImport {
  id: string
  at: string
  count: number
  /** Ekstrelerin kart adları ("Bonus •• 1234, DenizBank Black") */
  cardName: string
  months: string[]
  /** Bu içe aktarmayla açılan ekstreler; geri alınınca boş kalırlarsa silinir */
  createdStatementIds: string[]
  /** Bu içe aktarmayla oluşturulan kartlar; geri alınınca ekstresi kalmazsa silinir */
  createdCardIds?: string[]
}

export async function createCard(name: string, kind: CardKind): Promise<string> {
  const t = nowISO()
  const card: Card = { id: newId(), name: name.trim(), kind, currency: 'TRY', createdAt: t, updatedAt: t }
  await db.cards.add(card)
  return card.id
}

/** İçe aktarılacak bir ekstre: hangi kart (gerekirse yeni), hangi ay, hangi satırlar */
export interface ImportPart {
  card: Card
  /** Kart yeni oluşturulacaksa true */
  isNew: boolean
  /** Var olan karta eklenecek bilgiler (son 4 hane, banka) */
  adopt?: Partial<Pick<Card, 'last4' | 'bank'>>
  month: MonthMode
  rows: PlannedTx[]
  summary?: StatementSummary
  bank?: string | null
}

/**
 * Ekstreleri yazar (hepsi tek işlem, tek içe aktarma kimliği). Her kart + ay için bir ekstre kaydı;
 * yoksa açılır, varsa satırlar ona eklenir. Özet bilgisi seçilen ayın ekstresine yazılır. Yeni kartlar burada oluşur.
 */
export async function commitImport(parts: ImportPart[], newCategories: Category[]): Promise<LastImport> {
  const importId = newId()
  const now = nowISO()
  const usedCats = new Set(parts.flatMap((p) => p.rows.map((r) => r.categoryId)))
  const createdStatementIds: string[] = []
  const createdCardIds: string[] = []
  const allMonths = new Set<string>()
  let count = 0
  let last!: LastImport

  await db.transaction('rw', [db.cards, db.statements, db.transactions, db.categories, db.settings], async () => {
    const newCats = newCategories.filter((c) => usedCats.has(c.id))
    if (newCats.length) await db.categories.bulkPut(newCats)

    for (const p of parts) {
      // Aynı yeni kart birden fazla ekstrede olabilir (ör. iki ay): bir kez oluşturulur
      if (p.isNew && !createdCardIds.includes(p.card.id)) {
        await db.cards.add({ ...p.card, createdAt: now, updatedAt: now })
        createdCardIds.push(p.card.id)
      } else if (!p.isNew && p.adopt) await db.cards.update(p.card.id, { ...p.adopt, updatedAt: now })

      const months = [...new Set(p.rows.map((r) => r.month))]
      if (p.month !== 'date' && !months.includes(p.month)) months.push(p.month)
      const statementOf: Record<string, string> = {}
      for (const m of months) {
        allMonths.add(m)
        const summary = p.month === m ? p.summary : undefined
        const found = await db.statements.where('[cardId+month]').equals([p.card.id, m]).first()
        if (found) {
          statementOf[m] = found.id
          if (summary || (p.bank && !found.bank)) {
            await db.statements.update(found.id, { ...summary, ...(p.bank && !found.bank ? { bank: p.bank } : {}), updatedAt: now })
          }
        } else {
          const st: Statement = {
            id: newId(),
            cardId: p.card.id,
            month: m,
            currency: 'TRY',
            ...(p.bank ? { bank: p.bank } : {}),
            ...summary,
            createdAt: now,
            updatedAt: now,
          }
          await db.statements.add(st)
          statementOf[m] = st.id
          createdStatementIds.push(st.id)
        }
      }
      const txs: Transaction[] = p.rows.map((r) => ({ ...r, statementId: statementOf[r.month], importId }))
      if (txs.length) await db.transactions.bulkAdd(txs)
      count += txs.length
    }

    last = {
      id: importId,
      at: now,
      count,
      cardName: [...new Set(parts.map((p) => cardLabel(p.card)))].join(', '),
      months: [...allMonths].sort(),
      createdStatementIds,
      createdCardIds,
    }
    await db.settings.bulkPut([
      { key: 'lastCardId', value: parts[parts.length - 1]?.card.id },
      { key: 'lastImport', value: last },
    ])
  })
  return last
}

export async function undoImport(last: LastImport): Promise<void> {
  await db.transaction('rw', [db.cards, db.statements, db.transactions, db.settings], async () => {
    await db.transactions.where('importId').equals(last.id).delete()
    for (const id of last.createdStatementIds) {
      if ((await db.transactions.where('statementId').equals(id).count()) === 0) await db.statements.delete(id)
    }
    for (const id of last.createdCardIds ?? []) {
      if ((await db.statements.where('cardId').equals(id).count()) === 0) await db.cards.delete(id)
    }
    await db.settings.delete('lastImport')
  })
}

export async function deleteStatement(id: string): Promise<void> {
  await db.transaction('rw', [db.statements, db.transactions], async () => {
    await db.transactions.where('statementId').equals(id).delete()
    await db.statements.delete(id)
  })
}

export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', [db.cards, db.statements, db.transactions], async () => {
    await db.transactions.where('cardId').equals(id).delete()
    await db.statements.where('cardId').equals(id).delete()
    await db.cards.delete(id)
  })
}

/**
 * Satırın kategorisini değiştirir. `allOfMerchant`: aynı işyerinin (aynı türdeki) tüm satırları da değişir
 * ve sonraki içe aktarmalar için kural kaydedilir.
 */
export async function setCategory(tx: Transaction, categoryId: string, allOfMerchant: boolean): Promise<number> {
  const now = nowISO()
  if (!allOfMerchant) {
    await db.transactions.update(tx.id, { categoryId, updatedAt: now })
    return 1
  }
  const key = merchantKey(tx.merchant)
  return db.transaction('rw', [db.transactions, db.rules], async () => {
    const same = (await db.transactions.toArray()).filter((t) => t.type === tx.type && merchantKey(t.merchant) === key)
    await db.transactions.bulkUpdate(same.map((t) => ({ key: t.id, changes: { categoryId, updatedAt: now } })))
    await db.rules.put({ key, categoryId, updatedAt: now })
    return same.length
  })
}
