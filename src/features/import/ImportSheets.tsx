import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { ConfirmButton, Money, Segmented, Sheet } from '../../components/ui'
import { restoreBackup } from '../../db/backup'
import { db } from '../../db/db'
import { CARD_KINDS, useCards, useCategories } from '../../db/hooks'
import { commitImport, type ImportPart } from '../../db/statements'
import type { Card, CardKind, Category, Statement } from '../../db/types'
import type { BackupFile } from '../../domain/backup'
import { cardLabel, cardNameFor, guessKind, matchCard } from '../../domain/cards'
import { formatDateTR, formatMonthTR } from '../../domain/dates'
import {
  defaultMonth,
  monthOptions,
  planStatement,
  type ImportFile,
  type MonthMode,
  type PlannedRow,
  type PlannedTx,
} from '../../domain/importer'
import { newId, nowISO } from '../../lib/id'

const NEW = '__new'
const KIND_OPTIONS = Object.entries(CARD_KINDS).map(([k, v]) => [k, v.label]) as [CardKind, string][]

type RowEdit = { include?: boolean; categoryId?: string }
type ReviewRow = PlannedRow & { include: boolean }

/**
 * Dosyadaki her ekstre ayrı bölüm: hangi kart (son 4 haneye göre eşleşen ya da otomatik yeni), hangi ay, hangi satırlar.
 * Hepsi tek seferde kaydedilir ve tek seferde geri alınır.
 */
export function ImportSheet({ file, onClose }: { file: ImportFile; onClose: () => void }) {
  const cards = useCards()
  const categories = useCategories()
  const rules = useLiveQuery(async () => Object.fromEntries((await db.rules.toArray()).map((r) => [r.key, r.categoryId])))
  const existing = useLiveQuery(() => db.transactions.toArray())
  const statements = useLiveQuery(() => db.statements.toArray())
  const { setMonth } = useApp()
  const navigate = useNavigate()
  const sts = file.statements

  const [tempIds] = useState(() => sts.map(() => newId()))
  const [choice, setChoice] = useState<Record<number, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [kinds, setKinds] = useState<Record<string, CardKind>>({})
  const [months, setMonths] = useState<Record<number, MonthMode>>({})
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const [busy, setBusy] = useState(false)

  const ready = !!existing && !!rules
  const { blocks, cats, newCats } = buildBlocks({
    sts,
    cards,
    categories,
    rules: rules ?? {},
    existing: existing ?? [],
    statements: statements ?? [],
    tempIds,
    state: { choice, names, kinds, months, edits },
    plan: ready,
  })

  const parts: ImportPart[] = blocks
    .filter((b) => b.selected.length || (b.st.summary && b.month !== 'date'))
    .map((b) => ({ card: b.card, isNew: b.isNew, adopt: b.adopt, month: b.month, rows: b.selected, summary: b.st.summary, bank: b.st.account.bank }))
  const total = blocks.reduce((n, b) => n + b.selected.length, 0)
  const canCommit = ready && parts.length > 0 && !busy

  async function commit() {
    if (!canCommit) return
    setBusy(true)
    const last = await commitImport(parts, newCats)
    onClose()
    const fixed = parts.map((p) => p.month).filter((m) => m !== 'date')
    setMonth([...fixed, ...last.months].sort().pop()!)
    navigate('/')
  }

  return (
    <Sheet title={sts.length > 1 ? `${sts.length} ekstre` : 'Ekstreyi ekle'} onClose={onClose}>
      <div className="space-y-4">
        {file.invalid > 0 && <p className="text-sm text-zinc-500">{file.invalid} bozuk satır atlandı.</p>}
        {blocks.map((b) => {
          const sm = b.st.summary
          const pickValue = b.isNew ? NEW : b.card.id
          const newName = cardNameFor(b.account)
          return (
            <section key={b.i} className="space-y-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
              <h3 className="font-semibold">
                {sts.length > 1 && <span className="text-zinc-500">{b.i + 1}/{sts.length} · </span>}
                {CARD_KINDS[b.card.kind].icon} {cardLabel(b.card)}
                {b.month !== 'date' && <span className="text-zinc-500"> · {formatMonthTR(b.month)}</span>}
              </h3>
              <p className="text-xs text-zinc-500">
                {b.st.items.length} satır
                {b.plan?.skippedPayments ? ` · ${b.plan.skippedPayments} kart ödemesi sayılmadı` : ''}
                {sm?.statementDate && ` · kesim ${formatDateTR(sm.statementDate)}`}
                {sm?.dueDate && ` · son ödeme ${formatDateTR(sm.dueDate)}`}
                {sm?.statementBalance !== undefined && <> · ekstre borcu <Money value={sm.statementBalance} /></>}
              </p>

              <label className="block">
                <span className="label">Hangi kart / hesap?</span>
                <select
                  className="input"
                  value={pickValue}
                  onChange={(e) => setChoice((c) => ({ ...c, [b.i]: e.target.value }))}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {CARD_KINDS[c.kind].icon} {cardLabel(c)}
                    </option>
                  ))}
                  <option value={NEW}>+ Yeni: {b.isNew ? cardLabel(b.card) : newName}</option>
                </select>
                <span className="mt-1 block text-xs text-zinc-500">
                  {b.isNew
                    ? 'Bu ekstrenin kartı kayıtlı değil; eklerken otomatik oluşturulur.'
                    : b.adopt?.last4
                      ? `Kart eşleşti; son 4 hanesi •• ${b.adopt.last4} olarak kaydedilecek.`
                      : b.matched && b.card.id === pickValue
                        ? b.account.last4
                          ? `Son 4 haneye (${b.account.last4}) göre eşleşti.`
                          : 'Banka ve kart adına göre eşleşti.'
                        : 'Elle seçildi.'}
                </span>
              </label>
              {b.isNew && (
                <div className="space-y-2 rounded-xl border border-emerald-300 p-3 dark:border-emerald-800">
                  <label className="block">
                    <span className="label">Yeni kartın adı</span>
                    <input
                      className="input"
                      value={names[b.card.id] ?? newName}
                      onChange={(e) => setNames((n) => ({ ...n, [b.card.id]: e.target.value }))}
                    />
                  </label>
                  <Segmented value={b.card.kind} options={KIND_OPTIONS} onChange={(k) => setKinds((m) => ({ ...m, [b.card.id]: k }))} />
                </div>
              )}

              <label className="block">
                <span className="label">Hangi aya sayılsın?</span>
                <select className="input" value={b.month} onChange={(e) => setMonths((m) => ({ ...m, [b.i]: e.target.value }))}>
                  {monthOptions(b.st).map((m) => (
                    <option key={m} value={m}>
                      {formatMonthTR(m)} ekstresi
                    </option>
                  ))}
                  <option value="date">Her satır kendi tarihinin ayına</option>
                </select>
                {b.exists && (
                  <span className="mt-1 block text-xs text-zinc-500">
                    Bu kartın {formatMonthTR(b.month)} ekstresi zaten var; yeni satırlar ona eklenir, aynıları atlanır.
                  </span>
                )}
              </label>

              {b.rows.length > 0 && (
                <RowsReview
                  rows={b.rows}
                  categories={cats}
                  onEdit={(index, e) => setEdits((s) => ({ ...s, [`${b.i}:${index}`]: { ...s[`${b.i}:${index}`], ...e } }))}
                  onAll={(include) =>
                    setEdits((s) => ({ ...s, ...Object.fromEntries(b.rows.map((r) => [`${b.i}:${r.index}`, { ...s[`${b.i}:${r.index}`], include }])) }))
                  }
                />
              )}
            </section>
          )
        })}

        <button className="btn-primary sticky bottom-0 w-full shadow-lg" disabled={!canCommit} onClick={() => void commit()}>
          {!ready
            ? 'Hazırlanıyor…'
            : total
              ? `Ekle (${total} satır${parts.length > 1 ? `, ${parts.length} ekstre` : ''})`
              : parts.length
                ? 'Sadece özet bilgisini kaydet'
                : 'Eklenecek satır yok'}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Ekstreleri sırayla planlar: önceki ekstrenin eşleştirdiği / açtığı kart sonrakinde görülür (aynı kart iki ay
 * gelirse tek kart açılır; iki farklı kart aynı eski karta karışmaz). Tekrar kontrolü önceki ekstrenin satırlarını da sayar.
 */
function buildBlocks(o: {
  sts: ImportFile['statements']
  cards: Card[]
  categories: Category[]
  rules: Record<string, string>
  existing: PlannedTx[]
  statements: Statement[]
  tempIds: string[]
  state: {
    choice: Record<number, string>
    names: Record<string, string>
    kinds: Record<string, CardKind>
    months: Record<number, MonthMode>
    edits: Record<string, RowEdit>
  }
  plan: boolean
}) {
  const now = nowISO()
  let work: Card[] = [...o.cards]
  let cats: Category[] = o.categories
  const newCats: Category[] = []
  const planned: PlannedTx[] = []
  const newKeyToId: Record<string, string> = {}
  const blocks = []

  for (const [i, st] of o.sts.entries()) {
    const signs = !!st.summary || st.items.some((it) => it.type === 'payment' || it.installment)
    const account = { ...st.account, kind: guessKind(st.account, signs) }
    const idKey = account.last4 ?? cardNameFor(account)
    const match = matchCard(account, work)
    const pick = o.state.choice[i] ?? match.cardId ?? newKeyToId[idKey] ?? NEW
    const existingCard = work.find((c) => c.id === pick)
    const isNew = !existingCard || !o.cards.some((c) => c.id === existingCard.id)
    if (!existingCard) newKeyToId[idKey] ??= o.tempIds[i]
    const tempId = existingCard && isNew ? existingCard.id : newKeyToId[idKey]
    const card: Card = existingCard ?? {
      id: tempId,
      name: (o.state.names[tempId] ?? cardNameFor(account)).trim() || cardNameFor(account),
      kind: o.state.kinds[tempId] ?? account.kind,
      currency: 'TRY',
      ...(account.bank ? { bank: account.bank } : {}),
      ...(account.last4 ? { last4: account.last4 } : {}),
      createdAt: now,
      updatedAt: now,
    }
    const adopt = !isNew && pick === match.cardId ? match.adopt : undefined
    if (!existingCard) work = [...work, card]
    else if (adopt) work = work.map((c) => (c.id === card.id ? { ...c, ...adopt } : c))

    const month = o.state.months[i] ?? defaultMonth(st)
    const plan = o.plan
      ? planStatement(st.items, {
          cardId: card.id,
          month,
          categories: cats,
          rules: o.rules,
          existing: [...o.existing, ...planned].filter((t) => t.cardId === card.id),
          now,
          newId,
        })
      : null
    if (plan) {
      cats = [...cats, ...plan.newCategories]
      newCats.push(...plan.newCategories)
    }
    const rows: ReviewRow[] = (plan?.rows ?? []).map((r) => {
      const e = o.state.edits[`${i}:${r.index}`] ?? {}
      return { ...r, include: e.include ?? !r.duplicate, tx: { ...r.tx, categoryId: e.categoryId ?? r.tx.categoryId } }
    })
    const selected = rows.filter((r) => r.include).map((r) => r.tx)
    planned.push(...selected)
    const exists = !isNew && month !== 'date' && o.statements.some((s) => s.cardId === card.id && s.month === month)
    blocks.push({ st, i, account, card, isNew, adopt, month, plan, rows, selected, exists, matched: !!match.cardId })
  }
  return { blocks, cats, newCats }
}

function RowsReview({
  rows,
  categories,
  onEdit,
  onAll,
}: {
  rows: ReviewRow[]
  categories: Category[]
  onEdit: (index: number, e: RowEdit) => void
  onAll: (include: boolean) => void
}) {
  const selected = rows.filter((r) => r.include)
  const dup = rows.filter((r) => r.duplicate).length
  const sum = (type: string) => selected.filter((r) => r.tx.type === type).reduce((s, r) => s + r.tx.amount, 0)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="label mb-0">
          Satırlar: {selected.length} / {rows.length} seçili{dup ? ` · ${dup} zaten kayıtlı` : ''}
        </span>
        <span className="flex gap-3 text-sm">
          <button className="text-emerald-700 dark:text-emerald-400" onClick={() => onAll(true)}>
            Tümü
          </button>
          <button className="text-zinc-500" onClick={() => onAll(false)}>
            Hiçbiri
          </button>
        </span>
      </div>
      <div className="flex gap-4 text-sm">
        <span>
          Harcama <Money value={sum('expense')} sign="expense" className="font-semibold" />
        </span>
        {sum('income') > 0 && (
          <span>
            İade / gelen <Money value={sum('income')} sign="income" className="font-semibold" />
          </span>
        )}
      </div>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
        {rows.map((r) => {
          const cats = categories.filter((c) => c.kind === r.tx.type && (!c.archived || c.id === r.tx.categoryId))
          return (
            <li key={r.index} className={`space-y-2 p-3 ${r.include ? '' : 'opacity-50'}`}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5 accent-emerald-600"
                  checked={r.include}
                  onChange={(e) => onEdit(r.index, { include: e.target.checked })}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{r.tx.merchant}</span>
                  <span className="block text-xs break-words text-zinc-500">
                    {formatDateTR(r.tx.date)}
                    {r.tx.installment && ` · ${r.tx.installment.no}/${r.tx.installment.count} taksit`}
                    {r.tx.description !== r.tx.merchant && ` · ${r.tx.description}`}
                  </span>
                  {r.duplicate && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Zaten kayıtlı</span>}
                </span>
                <Money value={r.tx.amount} sign={r.tx.type} className="text-sm font-semibold" />
              </label>
              <div className="pl-8">
                <select
                  className="input min-h-9 w-auto py-1"
                  aria-label="Kategori"
                  value={r.tx.categoryId}
                  onChange={(e) => onEdit(r.index, { categoryId: e.target.value })}
                >
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function RestoreSheet({ file, onClose }: { file: BackupFile; onClose: (done: boolean) => void }) {
  const [error, setError] = useState('')
  async function restore() {
    try {
      await restoreBackup(file)
      onClose(true)
    } catch {
      setError('Geri yükleme başarısız oldu; mevcut veriye dokunulmadı.')
    }
  }
  return (
    <Sheet title="Yedekten geri yükle" onClose={() => onClose(false)}>
      <div className="space-y-4">
        <p>
          Yedek tarihi: <strong>{file.exportedAt ? new Date(file.exportedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'bilinmiyor'}</strong>
          <br />
          {file.data.cards.length} kart, {file.data.statements.length} ekstre, {file.data.transactions.length} satır
        </p>
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          Bu cihazdaki tüm veriler silinip yedektekilerle değiştirilecek.
        </p>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => onClose(false)}>
            Vazgeç
          </button>
          <ConfirmButton label="Geri yükle" onConfirm={() => void restore()} />
        </div>
      </div>
    </Sheet>
  )
}
