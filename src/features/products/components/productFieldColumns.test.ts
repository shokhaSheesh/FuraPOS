import { describe, expect, it } from 'vitest'
import { buildProductColumns } from './productColumns'
import { buildProductFieldColumns } from './productFieldColumns'
import type { VariationRow } from '../model/product'

const idsOf = (columns: { id?: string; accessorKey?: string }[]) =>
  columns.map((column) => column.id ?? column.accessorKey ?? '')

/**
 * The rule: a product picked onto a transfer, an order or a goods receipt is
 * shown with the same fields as one sitting in the catalogue. Two builders
 * exist only because the list sorts on `accessorKey`s the documents have no
 * use for — so this is what stops them drifting apart.
 */
describe('a document shows the same product fields as the catalogue', () => {
  const list = idsOf(
    buildProductColumns({
      onEdit: () => {},
      onDelete: () => {},
      canEdit: true,
      canDelete: true,
      canSeeCost: true,
    }),
    // Status and the row actions are not fields — they are how a catalogue row
    // is worked with, and a delivery note works with its lines differently.
  ).filter((id) => id !== 'status' && id !== 'actions')

  const document = idsOf(
    buildProductFieldColumns<VariationRow>({ variationOf: (row) => row, canSeeCost: true }),
  )

  it('carries every catalogue field, in the catalogue’s order', () => {
    expect(document).toEqual(list)
  })

  it('drops the supplier price for roles that may not see what we pay', () => {
    const hidden = idsOf(
      buildProductFieldColumns<VariationRow>({ variationOf: (row) => row, canSeeCost: false }),
    )
    expect(hidden).not.toContain('costPrice')
    expect(hidden).toEqual(document.filter((id) => id !== 'costPrice'))
  })
})
