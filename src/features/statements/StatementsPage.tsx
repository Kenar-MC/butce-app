import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { Empty, Money } from '../../components/ui'
import { db } from '../../db/db'
import { byId, useCards, useTransactions, kindIcon } from '../../db/hooks'
import { formatDateTR, formatMonthTR } from '../../domain/dates'
import { cardLabel } from '../../domain/cards'

export default function StatementsPage() {
  const cards = useCards()
  const cardById = byId(cards)
  const statements = useLiveQuery(() => db.statements.toArray())
  const txs = useTransactions()
  if (!statements || !txs) return null

  const stats = new Map<string, { expense: number; count: number }>()
  for (const t of txs) {
    const s = stats.get(t.statementId) ?? { expense: 0, count: 0 }
    if (t.type === 'expense') s.expense += t.amount
    s.count++
    stats.set(t.statementId, s)
  }
  const byMonth = new Map<string, typeof statements>()
  for (const s of [...statements].sort((a, b) => b.month.localeCompare(a.month) || (cardById[a.cardId]?.name ?? '').localeCompare(cardById[b.cardId]?.name ?? '', 'tr'))) {
    byMonth.set(s.month, [...(byMonth.get(s.month) ?? []), s])
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Ekstreler</h1>
        <p className="text-sm text-zinc-500">Her kartın her ayı bir ekstre. Aynı ayı tekrar yüklersen eksik satırlar eklenir, var olanlar atlanır.</p>
      </div>
      {!statements.length && <Empty>Henüz ekstre yok — sağ alttaki düğmeyle yükle.</Empty>}
      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month}>
          <h2 className="mb-1 px-1 text-sm text-zinc-500">{formatMonthTR(month)}</h2>
          <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
            {list.map((s) => {
              const card = cardById[s.cardId]
              const st = stats.get(s.id) ?? { expense: 0, count: 0 }
              return (
                <li key={s.id}>
                  <Link to={`/ekstreler/${s.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-2xl">{kindIcon(card?.kind)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words">{cardLabel(card)}</span>
                      <span className="block text-sm text-zinc-500">
                        {st.count} işlem{s.dueDate ? ` · son ödeme ${formatDateTR(s.dueDate)}` : ''}
                      </span>
                    </span>
                    <Money value={st.expense} sign="expense" className="font-semibold" />
                    <span aria-hidden className="text-zinc-400">
                      ›
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
