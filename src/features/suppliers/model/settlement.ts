import type { Id, IsoDate } from '@/shared/types'
import type { GoodsReceipt } from '@/features/receipts/model/receipt'
import type { WalletTransaction } from '@/shared/types/wallet'

/**
 * What one delivery cost, and how much of it is still owed.
 *
 * Derived from the ledger rather than stored on the receipt, for the same
 * reason a supplier's stats are: a stored figure is a figure that goes stale
 * the next time anybody pays anything. Every charge and every payment already
 * names the receipt it belongs to, so the arithmetic is just a regrouping of
 * movements that exist.
 *
 * A whole-supplier debt answers "how much do we owe them". It does not answer
 * "which of these deliveries have we actually paid for", which is the question
 * somebody has when the supplier rings up about one invoice.
 */
export interface Settlement {
  receiptId: Id
  number: string
  /** When the goods landed — what "oldest first" is ordered by. */
  at: IsoDate
  /** What the supplier invoiced for it, less anything a cancellation took back. */
  invoiced: number
  paid: number
  /** Never negative: an overpayment is supplier credit, which nothing models yet. */
  pending: number
}

type ReceiptLike = Pick<GoodsReceipt, 'id' | 'number' | 'receivedAt' | 'createdAt'>
type MovementLike = Pick<WalletTransaction, 'kind' | 'amount' | 'referenceType' | 'referenceId'>

export function settlementsFor(receipts: ReceiptLike[], movements: MovementLike[]): Settlement[] {
  const byReceipt = new Map<string, { invoiced: number; paid: number }>()

  for (const movement of movements) {
    if (movement.referenceType !== 'goods_receipt' || !movement.referenceId) continue
    const entry = byReceipt.get(movement.referenceId) ?? { invoiced: 0, paid: 0 }
    // A payment is negative and a cancellation reverses a charge, so the sign
    // does the work: `amount` is always "what this did to the debt".
    if (movement.kind === 'debt_repaid') entry.paid += -movement.amount
    else entry.invoiced += movement.amount
    byReceipt.set(movement.referenceId, entry)
  }

  return receipts
    .filter((receipt) => byReceipt.has(receipt.id))
    .map((receipt) => {
      const { invoiced, paid } = byReceipt.get(receipt.id)!
      return {
        receiptId: receipt.id,
        number: receipt.number,
        at: receipt.receivedAt ?? receipt.createdAt,
        invoiced,
        paid,
        pending: Math.max(0, invoiced - paid),
      }
    })
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** Just the deliveries somebody could still pay for, oldest first. */
export const outstanding = (settlements: Settlement[]) =>
  settlements.filter((settlement) => settlement.pending > 0)

export interface Allocation {
  receiptId: Id
  number: string
  amount: number
}

/**
 * Spread a payment across deliveries, oldest first.
 *
 * The default anywhere money is owed against several invoices: the debt that
 * has been outstanding longest is the one that gets cleared. Nothing is
 * allocated beyond what a delivery still owes, so a lump sum lands on several
 * and the leftover — if the payment is larger than everything outstanding —
 * comes back as `unallocated` for the caller to refuse.
 */
export function allocate(
  settlements: Settlement[],
  amount: number,
): { allocations: Allocation[]; unallocated: number } {
  let left = amount
  const allocations: Allocation[] = []

  for (const settlement of outstanding(settlements)) {
    if (left <= 0) break
    const take = Math.min(left, settlement.pending)
    allocations.push({ receiptId: settlement.receiptId, number: settlement.number, amount: take })
    left -= take
  }

  return { allocations, unallocated: left }
}

/** The option that means "spread it", which cannot be "" — Radix reads that as cleared. */
export const OLDEST_FIRST = 'oldest-first'
