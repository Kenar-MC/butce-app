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
  cardName: string
  months: string[]
  /** Bu içe aktarmayla açılan ekstreler; geri alınınca boş kalırlarsa silinir */
  createdStatementIds: string[]
}

export async function createCard(name: string, kind: CardKind): Promise<string> {
  const t = nowISO()
  const card: Card = { id: newId(), name: name.trim(), kind, currency: 'TRY', createdAt: t, updatedAt: t }
  await db.cards.add(card)
  return card.id
}

/**
 * Seçilen satırları ekstrelere yazar (tek işlem). Her kart + ay için bir ekstre kaydı;
 * yoksa açılır, varsa satırlar ona eklenir. Özet bilgisi (kesim/son ödeme tarihi, borç) seçilen ayın ekstresine yazılır.
 */
export async function commitImport(o: {
  card: Card
  month: MonthMode
  rows: PlannedTx[]
  newCategories: Category[]
  summary?: StatementSummary
  bank?: string | null
}): Promise<LastImport> {
  const importId = newId()
  const now = nowISO()
  const months = [...new Set(o.rows.map((r) => r.month))]
  if (o.month !== 'date' && o.summary && !months.includes(o.month)) months.push(o.month)
  const usedCats = new Set(o.rows.map((r) => r.categoryId))
  const created: string[] = []

  await db.transaction('rw', [db.statements, db.transactions, db.categories, db.settings], async () => {
    const newCats = o.newCategories.filter((c) => usedCats.has(c.id))
    if (newCats.length) await db.categories.bulkAdd(newCats)

    const statementOf: Record<string, string> = {}
    for (const m of months) {
      const summary = o.month === m ? o.summary : undefined
      const found = await db.statements.where('[cardId+month]').equals([o.card.id, m]).first()
      if (found) {
        statementOf[m] = found.id
        if (summary || (o.bank && !found.bank)) {
          await db.statements.update(found.id, { ...summary, ...(o.bank && !found.bank ? { bank: o.bank } : {}), updatedAt: now })
        }
      } else {
        const st: Statement = {
          id: newId(),
          cardId: o.card.id,
          month: m,
          currency: 'TRY',
          ...(o.bank ? { bank: o.bank } : {}),
          ...summary,
          createdAt: now,
          updatedAt: now,
        }
        await db.statements.add(st)
        statementOf[m] = st.id
        created.push(st.id)
      }
    }

    const txs: Transaction[] = o.rows.map((r) => ({ ...r, statementId: statementOf[r.month], importId }))
    if (txs.length) await db.transactions.bulkAdd(txs)
    await db.settings.bulkPut([
      { key: 'lastCardId', value: o.card.id },
      {
        key: 'lastImport',
        value: { id: importId, at: now, count: txs.length, cardName: o.card.name, months, createdStatementIds: created } satisfies LastImport,
      },
    ])
  })
  return { id: importId, at: now, count: o.rows.length, cardName: o.card.name, months, createdStatementIds: created }
}

export async function undoImport(last: LastImport): Promise<void> {
  await db.transaction('rw', [db.statements, db.transactions, db.settings], async () => {
    await db.transactions.where('importId').equals(last.id).delete()
    for (const id of last.createdStatementIds) {
      if ((await db.transactions.where('statementId').equals(id).count()) === 0) await db.statements.delete(id)
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
    const same = await db.transactions.filter((t) => t.type === tx.type && merchantKey(t.merchant) === key).toArray()
    await db.transactions.bulkUpdate(same.map((t) => ({ key: t.id, changes: { categoryId, updatedAt: now } })))
    await db.rules.put({ key, categoryId, updatedAt: now })
    return same.length
  })
}
