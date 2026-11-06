import type { Card, Category, Transaction } from '../db/types'
import { formatDayTR } from '../domain/dates'
import { Empty, Money } from './ui'

const THIS_YEAR = new Date().getFullYear()

/** Güne göre gruplu ekstre satırları; satıra dokununca onPick */
export function TxList({
  txs,
  catById,
  cardById,
  onPick,
  emptyText = 'Bu dönemde işlem yok.',
}: {
  txs: Transaction[]
  catById: Record<string, Category>
  /** Verilirse satırda kart adı da yazar (birden fazla kart varken) */
  cardById?: Record<string, Card>
  onPick: (t: Transaction) => void
  emptyText?: string
}) {
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
  const groups = new Map<string, Transaction[]>()
  for (const t of sorted) groups.set(t.date, [...(groups.get(t.date) ?? []), t])
  if (!sorted.length) return <Empty>{emptyText}</Empty>

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([date, items]) => {
        const spent = items.reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0)
        return (
          <section key={date}>
            <div className="mb-1 flex justify-between px-1 text-sm text-zinc-500">
              <span>{formatDayTR(date, THIS_YEAR)}</span>
              {spent > 0 && <Money value={spent} sign="expense" />}
            </div>
            <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
              {items.map((t) => {
                const cat = catById[t.categoryId]
                const sub = [
                  cat?.name ?? 'Kategori yok',
                  t.installment && `${t.installment.no}/${t.installment.count} taksit`,
                  cardById && cardById[t.cardId]?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={t.id}>
                    <button onClick={() => onPick(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full text-lg"
                        style={{ background: `${cat?.color ?? '#64748b'}22` }}
                      >
                        {cat?.icon ?? '❔'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.merchant}</span>
                        <span className="block truncate text-sm text-zinc-500">{sub}</span>
                      </span>
                      <Money value={t.amount} sign={t.type} className="font-semibold" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
