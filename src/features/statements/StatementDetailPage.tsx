import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useApp } from '../../components/AppContext'
import { TxList } from '../../components/TxList'
import { BarRow, ConfirmButton, Empty, Money } from '../../components/ui'
import { db } from '../../db/db'
import { byId, useCards, useCategories, kindIcon } from '../../db/hooks'
import { deleteStatement } from '../../db/statements'
import { formatDateTR, formatMonthTR } from '../../domain/dates'
import { categoryTotals, monthlyTotals } from '../../domain/stats'
import { cardLabel } from '../../domain/cards'

export default function StatementDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { openTx, setMonth } = useApp()
  const catById = byId(useCategories())
  const cards = useCards()
  const st = useLiveQuery(async () => (await db.statements.get(id)) ?? null, [id])
  const txs = useLiveQuery(() => db.transactions.where('statementId').equals(id).toArray(), [id])
  const [openCat, setOpenCat] = useState<string | null>(null)

  if (st === undefined || !txs) return null
  if (st === null) return <Empty>Ekstre bulunamadı.</Empty>
  const card = cards.find((c) => c.id === st.cardId)
  const sum = monthlyTotals(txs, [st.month])[0]
  const cats = categoryTotals(txs)
  type Fact = [string, ReactNode]
  const facts: Fact[] = []
  if (st.statementDate) facts.push(['Hesap kesim', formatDateTR(st.statementDate, true)])
  if (st.dueDate) facts.push(['Son ödeme', formatDateTR(st.dueDate, true)])
  if (st.statementBalance !== undefined) facts.push(['Ekstre borcu', <Money key="b" value={st.statementBalance} />])
  if (st.minimumPayment !== undefined) facts.push(['Asgari ödeme', <Money key="m" value={st.minimumPayment} />])
  if (st.totalDebt !== undefined) facts.push(['Kalan toplam borç', <Money key="t" value={st.totalDebt} />])

  async function remove() {
    await deleteStatement(id)
    navigate('/ekstreler')
  }

  return (
    <div className="space-y-4">
      <Link to="/ekstreler" className="inline-flex min-h-11 items-center text-emerald-700 dark:text-emerald-400">
        ‹ Ekstreler
      </Link>

      <section className="card space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{kindIcon(card?.kind)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold break-words">{cardLabel(card)}</h1>
            <p className="text-sm text-zinc-500">{formatMonthTR(st.month)} ekstresi</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-zinc-500">Harcama ({sum.count} işlem)</div>
            <Money value={sum.expense} sign="expense" className="text-lg font-bold" />
          </div>
          {sum.income > 0 && (
            <div>
              <div className="text-xs text-zinc-500">İade / gelen</div>
              <Money value={sum.income} sign="income" className="text-lg font-bold" />
            </div>
          )}
        </div>
        {facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-zinc-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <button
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
          onClick={() => {
            setMonth(st.month)
            navigate('/')
          }}
        >
          Bu ayın özetine git ›
        </button>
      </section>

      {cats.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Kategoriler</h2>
          {cats.map((c) => {
            const cat = catById[c.categoryId]
            const pct = Math.round(c.share * 100)
            return (
              <BarRow
                key={c.categoryId}
                icon={cat?.icon ?? '❔'}
                title={cat?.name ?? 'Kategorisiz'}
                sub={`${c.count} işlem · %${pct}`}
                amount={c.amount}
                pct={pct}
                color={cat?.color ?? '#94a3b8'}
                open={openCat === c.categoryId}
                onToggle={() => setOpenCat(openCat === c.categoryId ? null : c.categoryId)}
              >
                <TxList txs={txs.filter((t) => t.type === 'expense' && t.categoryId === c.categoryId)} catById={catById} onPick={openTx} />
              </BarRow>
            )
          })}
        </section>
      )}

      <h2 className="px-1 font-semibold">Tüm satırlar</h2>
      <TxList txs={txs} catById={catById} onPick={openTx} emptyText="Bu ekstrede satır yok." />

      <div className="pt-2">
        <ConfirmButton label={`Ekstreyi sil (${txs.length} satır)`} onConfirm={() => void remove()} />
      </div>
    </div>
  )
}
