import { describe, expect, it } from 'vitest'
import type { Card } from '../db/types'
import { cardLabel, cardNameFor, matchCard } from './cards'

const card = (id: string, name: string, o: Partial<Card> = {}): Card => ({
  id, name, kind: 'credit_card', currency: 'TRY', createdAt: '', updatedAt: '', ...o,
})
const acc = (o: Partial<{ bank: string | null; name: string | null; last4: string | null; kind: 'credit_card' | 'bank' | null }>) => ({
  bank: null, name: null, last4: null, kind: null, ...o,
})

describe('matchCard', () => {
  const bonus = card('bonus', 'Garanti BBVA Bonus', { bank: 'Garanti BBVA', last4: '1234' })
  const miles = card('miles', 'Garanti BBVA Miles&Smiles', { bank: 'Garanti BBVA', last4: '5678' })
  const deniz = card('deniz', 'DenizBank Black', { bank: 'DenizBank', last4: '4417' })
  const vadesiz = card('vadesiz', 'Garanti Vadesiz', { bank: 'Garanti BBVA', kind: 'bank' })

  it('son 4 haneye göre doğru kartı bulur, aynı bankanın diğer kartına karıştırmaz', () => {
    const cards = [bonus, miles, deniz, vadesiz]
    expect(matchCard(acc({ bank: 'Garanti BBVA', last4: '5678', kind: 'credit_card' }), cards)).toEqual({ cardId: 'miles' })
    expect(matchCard(acc({ bank: 'Garanti BBVA', last4: '9999', kind: 'credit_card' }), cards)).toEqual({})
  })
  it('son 4 hanesi kayıtlı olmayan tek eski karta son 4 haneyi ekler', () => {
    const old = card('old', 'Garanti kart')
    expect(matchCard(acc({ bank: 'Garanti BBVA', name: 'Bonus', last4: '1234', kind: 'credit_card' }), [old, deniz])).toEqual({
      cardId: 'old',
      adopt: { last4: '1234', bank: 'Garanti BBVA' },
    })
    // Aynı bankadan iki eski kart: emin değil, yeni kart
    expect(matchCard(acc({ bank: 'Garanti', last4: '1234' }), [old, card('old2', 'Garanti Miles')])).toEqual({})
  })
  it('son 4 hane yoksa: birebir ad ya da bankadaki tek uygun kart; tür farklıysa eşlemez', () => {
    expect(matchCard(acc({ bank: 'DenizBank', name: 'Black' }), [deniz, bonus])).toEqual({ cardId: 'deniz' })
    expect(matchCard(acc({ bank: 'Garanti BBVA' }), [bonus, miles])).toEqual({})
    expect(matchCard(acc({ bank: 'Garanti BBVA', kind: 'bank' }), [bonus, miles, vadesiz])).toEqual({ cardId: 'vadesiz' })
    expect(matchCard(acc({ bank: 'Akbank' }), [bonus])).toEqual({})
  })
})

describe('kart adı', () => {
  it('yeni kartın adı ve görünen etiket', () => {
    expect(cardNameFor(acc({ bank: 'Garanti BBVA', name: 'Bonus Platinum' }))).toBe('Garanti BBVA Bonus Platinum')
    expect(cardNameFor(acc({ bank: 'DenizBank', name: 'DenizBank Black' }))).toBe('DenizBank Black')
    expect(cardNameFor(acc({ bank: 'Akbank', kind: 'bank' }))).toBe('Akbank hesap')
    expect(cardNameFor(acc({}))).toBe('Kredi kartı')
    expect(cardLabel({ name: 'Bonus', last4: '1234' })).toBe('Bonus •• 1234')
  })
})
