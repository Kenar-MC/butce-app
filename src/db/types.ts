export type Currency = 'TRY'
export type AccountType = 'cash' | 'bank' | 'credit_card'
export type TxType = 'income' | 'expense' | 'transfer'
export type CategoryKind = 'income' | 'expense'
export type Frequency = 'weekly' | 'monthly' | 'yearly'

interface Stamped {
  createdAt: string
  updatedAt: string
}

export interface Account extends Stamped {
  id: string
  name: string
  type: AccountType
  currency: Currency
  /** kuruş; kredi kartında mevcut borç negatif */
  openingBalance: number
  color?: string
  archived: boolean
}

export interface Category extends Stamped {
  id: string
  name: string
  kind: CategoryKind
  icon: string
  color: string
  archived: boolean
  sortOrder: number
}

export interface Transaction extends Stamped {
  id: string
  type: TxType
  /** kuruş, > 0 */
  amount: number
  currency: Currency
  /** YYYY-MM-DD */
  date: string
  accountId: string
  toAccountId?: string
  categoryId?: string
  note?: string
  installmentPlanId?: string
  installmentNo?: number
  recurringRuleId?: string
}

export interface InstallmentPlan extends Stamped {
  id: string
  accountId: string
  categoryId: string
  totalAmount: number
  currency: Currency
  count: number
  firstDate: string
  note?: string
}

export interface RecurringRule extends Stamped {
  id: string
  type: TxType
  amount: number
  currency: Currency
  accountId: string
  toAccountId?: string
  categoryId?: string
  note?: string
  frequency: Frequency
  startDate: string
  endDate?: string
  lastGeneratedDate?: string
  active: boolean
}

export interface Budget extends Stamped {
  id: string
  categoryId: string
  monthlyLimit: number
  currency: Currency
}

export interface Setting {
  key: string
  value: unknown
}
