import { SalesListPage } from './SalesListPage'

/**
 * The dedicated lifecycle screens. Each is the same table pinned to one
 * status, so the chips are hidden — the page title already says which.
 */
export function OpenSalesPage() {
  return (
    <SalesListPage
      title="Open sales"
      description="Started but not finished. Nothing is reserved and no stock has moved."
      lockedStatus="open"
    />
  )
}

export function ClosedSalesPage() {
  return (
    <SalesListPage
      title="Closed sales"
      description="Finished and settled."
      lockedStatus="completed"
    />
  )
}

export function PostponedSalesPage() {
  return (
    <SalesListPage
      title="Postponed sales"
      description="Held for a customer until the reservation expires."
      lockedStatus="postponed"
    />
  )
}

export function DeletedSalesPage() {
  return (
    <SalesListPage
      title="Deleted sales"
      description="Kept for audit. A deleted sale is never removed from the ledger."
      lockedStatus="deleted"
    />
  )
}
