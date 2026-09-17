import { useDataStore } from '@/data/store'

/**
 * Where a variation lives on the shelf — "1-A-23-4" — as a suffix for the SKU
 * line under a product's name.
 *
 * Read live from the catalogue rather than copied onto the document, because
 * it answers "where do I walk to *now*": a part moved to another bin last week
 * should send the picker to the new bin, not to where it sat when the order
 * was written. Renders nothing for a variation without one, so an unaddressed
 * part reads exactly as it did before.
 */
export function StorageAddress({ variationId }: { variationId: string }) {
  const address = useDataStore(
    (s) => s.variations.find((variation) => variation.id === variationId)?.shelfAddress,
  )
  if (!address) return null
  return (
    <span className="text-fg-muted" title="Storage address">
      {' · '}
      {address}
    </span>
  )
}
