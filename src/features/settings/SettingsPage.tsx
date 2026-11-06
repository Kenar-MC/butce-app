import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmButton, Segmented, Sheet } from '../../components/ui'
import { db } from '../../db/db'
import { CARD_KINDS, useCards, useCategories } from '../../db/hooks'
import { deleteCard } from '../../db/statements'
import type { Card, CardKind, Category, CategoryKind } from '../../db/types'
import { newId, nowISO } from '../../lib/id'
import mascot from '../../assets/mascot.webp'
import DataSection from './DataSection'

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b']
const KINDS: [CategoryKind, string][] = [
  ['expense', 'Gider'],
  ['income', 'Gelir'],
]

export default function SettingsPage() {
  const categories = useCategories()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<{ cat?: Category } | null>(null)
  const list = categories.filter((c) => c.kind === kind)
  const cards = useCards()
  const counts = useLiveQuery(async () => {
    const m: Record<string, number> = {}
    await db.statements.each((s) => (m[s.cardId] = (m[s.cardId] ?? 0) + 1))
    return m
  })
  const [editCard, setEditCard] = useState<Card | null>(null)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ayarlar</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">Kartlar ve hesaplar</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-zinc-500">İlk ekstreyi yüklerken kart oluşturulur.</p>
        ) : (
          <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
            {cards.map((c) => (
              <li key={c.id}>
                <button onClick={() => setEditCard(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="text-2xl">{CARD_KINDS[c.kind].icon}</span>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-sm text-zinc-500">{counts?.[c.id] ?? 0} ekstre</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Kategoriler</h2>
          <button className="btn-ghost" onClick={() => setEditing({})}>
            + Kategori ekle
          </button>
        </div>
        <Segmented value={kind} options={KINDS} onChange={setKind} />
        <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
          {list.map((c) => (
            <li key={c.id}>
              <button onClick={() => setEditing({ cat: c })} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${c.archived ? 'opacity-50' : ''}`}>
                <span className="grid size-10 place-items-center rounded-full text-lg" style={{ background: `${c.color}22` }}>
                  {c.icon}
                </span>
                <span className="flex-1 font-medium">{c.name}</span>
                {c.archived && <span className="text-xs text-zinc-500">arşivde</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <DataSection />

      <img src={mascot} alt="" className="mx-auto size-12 rounded-xl opacity-90" />
      <p className="pb-2 text-center text-xs text-zinc-400">
        Sürüm {__APP_VERSION__} · {new Date(__BUILD_DATE__).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </p>

      {editCard && <CardSheet card={editCard} statements={counts?.[editCard.id] ?? 0} onClose={() => setEditCard(null)} />}
      {editing && <CategorySheet cat={editing.cat} kind={kind} sortOrder={list.length} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CategorySheet({ cat, kind, sortOrder, onClose }: { cat?: Category; kind: CategoryKind; sortOrder: number; onClose: () => void }) {
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState(cat?.icon ?? '🏷️')
  const [color, setColor] = useState(cat?.color ?? COLORS[7])
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) return setError('Kategori adı gir')
    const now = nowISO()
    await db.categories.put({
      ...(cat ?? { id: newId(), kind, archived: false, sortOrder, createdAt: now }),
      name: name.trim(),
      icon: icon.trim() || '🏷️',
      color,
      updatedAt: now,
    })
    onClose()
  }

  async function toggleArchive() {
    if (cat) await db.categories.update(cat.id, { archived: !cat.archived, updatedAt: nowISO() })
    onClose()
  }

  return (
    <Sheet title={cat ? 'Kategoriyi düzenle' : 'Yeni kategori'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <label className="block">
            <span className="label">İkon</span>
            <input className="input text-center text-2xl" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Ad</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!cat} />
          </label>
        </div>
        <div>
          <span className="label">Renk</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`size-11 rounded-full ${c === color ? 'ring-4 ring-zinc-900/30 dark:ring-white/50' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          {cat && (
            <button type="button" className="btn-ghost" onClick={() => void toggleArchive()}>
              {cat.archived ? 'Arşivden çıkar' : 'Arşivle'}
            </button>
          )}
          <button type="submit" className="btn-primary flex-1">
            Kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}

const KIND_OPTIONS = Object.entries(CARD_KINDS).map(([k, v]) => [k, v.label]) as [CardKind, string][]

function CardSheet({ card, statements, onClose }: { card: Card; statements: number; onClose: () => void }) {
  const [name, setName] = useState(card.name)
  const [kind, setKind] = useState<CardKind>(card.kind)

  async function save() {
    if (!name.trim()) return
    await db.cards.update(card.id, { name: name.trim(), kind, updatedAt: nowISO() })
    onClose()
  }

  return (
    <Sheet title="Kartı düzenle" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="block">
          <span className="label">Ad</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <Segmented value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <div className="flex flex-wrap gap-2 pt-2">
          <ConfirmButton label={`Sil (${statements} ekstre)`} onConfirm={() => void deleteCard(card.id).then(onClose)} />
          <button type="submit" className="btn-primary flex-1" disabled={!name.trim()}>
            Kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}
