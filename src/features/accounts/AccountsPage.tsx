import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { AmountInput, ConfirmButton, Empty, Money, Segmented, Sheet } from '../../components/ui'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, useAccounts, useBalances } from '../../db/hooks'
import type { Account, AccountType } from '../../db/types'
import { parseAmount, toInputString } from '../../domain/money'
import { newId, nowISO } from '../../lib/id'

export default function AccountsPage() {
  const accounts = useAccounts()
  const balances = useBalances(accounts)
  const [editing, setEditing] = useState<{ acc?: Account } | null>(null)
  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const total = active.reduce((s, a) => s + (balances[a.id] ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Hesaplar</h1>
        <button className="btn-ghost" onClick={() => setEditing({})}>
          + Hesap ekle
        </button>
      </div>

      <div className="card">
        <div className="text-sm text-zinc-500">Toplam</div>
        <Money value={total} className="text-2xl font-bold" />
      </div>

      {active.length === 0 && <Empty>Henüz hesap yok.</Empty>}
      <AccountList items={active} balances={balances} onPick={(acc) => setEditing({ acc })} />

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer px-1 text-sm text-zinc-500">Arşivlenmiş ({archived.length})</summary>
          <div className="mt-2 opacity-70">
            <AccountList items={archived} balances={balances} onPick={(acc) => setEditing({ acc })} />
          </div>
        </details>
      )}

      {editing && <AccountSheet acc={editing.acc} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AccountList({ items, balances, onPick }: { items: Account[]; balances: Record<string, number>; onPick: (a: Account) => void }) {
  if (!items.length) return null
  return (
    <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
      {items.map((a) => (
        <li key={a.id}>
          <button onClick={() => onPick(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className="text-2xl">{ACCOUNT_TYPES[a.type].icon}</span>
            <span className="flex-1">
              <span className="block font-medium">{a.name}</span>
              <span className="block text-sm text-zinc-500">{ACCOUNT_TYPES[a.type].label}</span>
            </span>
            <Money value={balances[a.id] ?? 0} className="font-semibold" />
          </button>
        </li>
      ))}
    </ul>
  )
}

const TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).map(([k, v]) => [k, v.label]) as [AccountType, string][]

function AccountSheet({ acc, onClose }: { acc?: Account; onClose: () => void }) {
  const [name, setName] = useState(acc?.name ?? '')
  const [type, setType] = useState<AccountType>(acc?.type ?? 'bank')
  // Kredi kartında kullanıcı borcu pozitif girer, negatif saklanır
  const [opening, setOpening] = useState(acc && acc.openingBalance ? toInputString(Math.abs(acc.openingBalance)) : '')
  const [error, setError] = useState('')
  const txCount = useLiveQuery(
    async () =>
      acc
        ? (await db.transactions.where('accountId').equals(acc.id).count()) +
          (await db.transactions.where('toAccountId').equals(acc.id).count())
        : 0,
    [acc?.id],
  )

  async function save() {
    if (!name.trim()) return setError('Hesap adı gir')
    const value = opening.trim() ? parseAmount(opening) : 0
    if (value === null) return setError('Geçerli bir tutar gir')
    const now = nowISO()
    await db.accounts.put({
      ...(acc ?? { id: newId(), createdAt: now, archived: false }),
      name: name.trim(),
      type,
      currency: 'TRY',
      openingBalance: type === 'credit_card' ? -value : value,
      updatedAt: now,
    })
    onClose()
  }

  async function setArchived(archived: boolean) {
    if (acc) await db.accounts.update(acc.id, { archived, updatedAt: nowISO() })
    onClose()
  }

  async function remove() {
    if (acc) await db.accounts.delete(acc.id)
    onClose()
  }

  return (
    <Sheet title={acc ? 'Hesabı düzenle' : 'Yeni hesap'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="block">
          <span className="label">Hesap adı</span>
          <input className="input" placeholder="ör. Garanti Vadesiz" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!acc} />
        </label>
        <div>
          <span className="label">Tür</span>
          <Segmented value={type} options={TYPE_OPTIONS} onChange={setType} />
        </div>
        <div>
          <span className="label">{type === 'credit_card' ? 'Mevcut borç (açılışta)' : 'Açılış bakiyesi'}</span>
          <AmountInput value={opening} onChange={setOpening} />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          {acc && txCount === 0 && <ConfirmButton onConfirm={() => void remove()} />}
          {acc && (
            <button type="button" className="btn-ghost" onClick={() => void setArchived(!acc.archived)}>
              {acc.archived ? 'Arşivden çıkar' : 'Arşivle'}
            </button>
          )}
          <button type="submit" className="btn-primary flex-1">
            Kaydet
          </button>
        </div>
        {acc && !!txCount && (
          <p className="text-xs text-zinc-500">Bu hesapta {txCount} işlem var; silinemez, arşivlenebilir.</p>
        )}
      </form>
    </Sheet>
  )
}
