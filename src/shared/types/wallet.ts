import type { Id, IsoDate } from './common'

/**
 * Clients, Employees and Suppliers are different entities that all expose the
 * SAME wallet sub-view (see CLAUDE.md: "wallet-as-a-shared-component").
 * Keep this type owner-agnostic — never fork it per entity.
 */
export type WalletOwnerType = 'client' | 'employee' | 'supplier'

export interface Wallet {
  ownerId: Id
  ownerType: WalletOwnerType
  /** Positive = we owe them, negative = they owe us. */
  balance: number
  cashback: number
  debt: number
  creditLimit: number | null
  currency: string
  updatedAt: IsoDate
}

export type WalletTransactionKind =
  | 'topup'
  | 'withdrawal'
  | 'purchase'
  | 'refund'
  | 'cashback_earned'
  | 'cashback_spent'
  | 'debt_charged'
  | 'debt_repaid'
  | 'adjustment'

export interface WalletTransaction {
  id: Id
  ownerId: Id
  ownerType: WalletOwnerType
  kind: WalletTransactionKind
  amount: number
  balanceAfter: number
  comment: string | null
  /** Sale / purchase-order / payroll document this movement came from. */
  referenceType: string | null
  referenceId: Id | null
  createdAt: IsoDate
  createdBy: { id: Id; name: string } | null
}

/** AI-generated commentary shown in the wallet's "insights" tab. */
export interface WalletInsight {
  id: Id
  title: string
  body: string
  tone: 'positive' | 'neutral' | 'risk'
  generatedAt: IsoDate
}
