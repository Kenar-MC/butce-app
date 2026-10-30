import type { Account, Category, Transaction } from '../db/types'
import { formatDayTR } from '../domain/dates'
import { totals } from '../domain/reports'
import { Empty, Money } from './ui'

const THIS_YEAR = new Date().getFullYear()

/** Güne göre gruplu işlem listesi; satıra dokununca onPick */
export function TxList({
  txs,
  accById,
  catById,
  onPick,
  emptyText = 'Bu ay için işlem yok — + ile ekle.',
}: {
  txs: Transaction[]
  accById: Record<string, Account>
  catById: Record<string, Category>
  onPick: (t: Transaction) => void
  emptyText?: string
}) {
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const groups = new Map<string, Transaction[]>()
  for (const t of sorted) groups.set(t.date, [...(groups.get(t.date) ?? []), t])
  if (!sorted.length) return <Empty>{emptyText}</Empty>

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([date, items]) => {
        const day = totals(items)
        return (
          <section key={date}>
            <div className="mb-1 flex justify-between px-1 text-sm text-zinc-500">
              <span>{formatDayTR(date, THIS_YEAR)}</span>
              {day.net !== 0 && <Money value={Math.abs(day.net)} sign={day.net > 0 ? 'income' : 'expense'} />}
            </div>
            <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
              {items.map((t) => {
                const cat = t.categoryId ? catById[t.categoryId] : undefined
                const acc = accById[t.accountId]?.name ?? '?'
                const sub = t.type === 'transfer' ? `${acc} → ${(t.toAccountId && accById[t.toAccountId]?.name) || '?'}` : acc
                return (
                  <li key={t.id}>
                    <button onClick={() => onPick(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full text-lg"
                        style={{ background: `${cat?.color ?? '#64748b'}22` }}
                      >
                        {t.type === 'transfer' ? '⇄' : (cat?.icon ?? '❔')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {t.note || (t.type === 'transfer' ? 'Transfer' : (cat?.name ?? 'Kategori yok'))}
                        </span>
                        <span className="block truncate text-sm text-zinc-500">
                          {t.note && cat ? `${cat.name} · ` : ''}
                          {sub}
                        </span>
                      </span>
                      {t.type === 'transfer' ? (
                        <Money value={t.amount} className="text-zinc-500" />
                      ) : (
                        <Money value={t.amount} sign={t.type} className="font-semibold" />
                      )}
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
