import { useMemo, type ReactNode } from 'react'
import { ProductCatalogue, SalesFigures } from '@/shared/components/catalogue/ProductCatalogue'
import { StockBox, StockPill } from '@/shared/components/catalogue/StockBox'
import {
  DialogStat,
  QuantityStepper,
  VariationsDialog,
} from '@/shared/components/catalogue/VariationsDialog'
import { sumRows, type ProductGroup } from '@/shared/components/catalogue/browse'
import type { TableColumn } from '@/shared/components/table/features'
import { formatNumber } from '@/shared/lib/format'
import type { TransferRow } from './transferLineColumns'

interface Names {
  from: string
  to: string
  demand: string
  /**
   * Whose shelf is yours. Sending, it is the source; requesting, it is the
   * destination — and yours is the one whose stock is coloured by level.
   */
  requesting: boolean
}

type Group = ProductGroup<TransferRow>

const atSource = (group: Group) => sumRows(group, (row) => row.atSource)
const atDestination = (group: Group) => sumRows(group, (row) => row.atDestination)

/**
 * The sending shelf, browsed as the client's mockup has it — the shared
 * catalogue with a transfer's own figures: both ends' stock, yours judged by
 * level and theirs in blue, and what sold where the goods are going.
 */
export function TransferCatalogue({
  rows,
  names,
  canSeeCost,
  onApply,
  actions,
}: {
  rows: TransferRow[]
  names: Names
  canSeeCost: boolean
  onApply: (changes: { row: TransferRow; quantity: number }[]) => void
  actions?: ReactNode
}) {
  /** Yours first, theirs second — on cards, in the list and in the dialog. */
  const sides = useMemo(
    () =>
      names.requesting
        ? [
            { id: 'atDestination', side: 'mine' as const, name: names.to, units: atDestination },
            { id: 'atSource', side: 'theirs' as const, name: names.from, units: atSource },
          ]
        : [
            { id: 'atSource', side: 'mine' as const, name: names.from, units: atSource },
            { id: 'atDestination', side: 'theirs' as const, name: names.to, units: atDestination },
          ],
    [names.requesting, names.from, names.to],
  )

  const ownColumns = useMemo<TableColumn<Group>[]>(
    () => [
      ...sides.map((s): TableColumn<Group> => ({
        id: s.id === 'atSource' ? 'atFrom' : 'atTo',
        header: `At ${s.name}`,
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side={s.side} units={s.units(row.original)} />,
      })),
      {
        id: 'sold',
        header: `Sold at ${names.demand}, 3 / 6 mo`,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="text-fg-muted tabular-nums">
            {formatNumber(row.original.demand[3])} /{' '}
            <strong className="text-fg font-medium">{formatNumber(row.original.demand[6])}</strong>
          </span>
        ),
      },
    ],
    [sides, names.demand],
  )

  return (
    <ProductCatalogue
      rows={rows}
      storageKey="transfer"
      ownFieldsTitle="This transfer"
      ownFields={[
        { id: 'atDestination', label: `At ${names.to}` },
        { id: 'atSource', label: `At ${names.from}` },
        { id: 'sales', label: `Sold at ${names.demand}` },
      ]}
      defaultFields={['variations', 'atDestination', 'atSource', 'sales']}
      canSeeCost={canSeeCost}
      ownColumns={ownColumns}
      actions={actions}
      renderStats={(group, has) => {
        const shown = sides.filter((s) => has(s.id))
        return shown.length ? (
          <div className="grid grid-cols-2 gap-1.5">
            {shown.map((s) => (
              <StockBox key={s.id} side={s.side} label={`At ${s.name}`} units={s.units(group)} />
            ))}
          </div>
        ) : null
      }}
      renderSales={(group, has) =>
        has('sales') ? (
          <SalesFigures demand={group.demand} title={`Sold at ${names.demand}`} />
        ) : null
      }
      renderDialog={(group, close) => (
        <VariationsDialog
          group={group}
          onClose={close}
          storageKey="transfer-product-variations"
          canSeeCost={canSeeCost}
          initial={(row) => ({
            quantity: row.quantity,
            unitCost: row.variation.costPrice,
            costCurrency: row.variation.costCurrency,
          })}
          // Never more than the sending shelf holds.
          maxOf={(row) => row.atSource}
          applyLabel={(alreadyOn) => (alreadyOn ? 'Update the transfer' : 'Add to transfer')}
          onApply={(changes) =>
            onApply(changes.map(({ row, draft }) => ({ row, quantity: draft.quantity })))
          }
          stats={(open) => (
            <>
              {sides.map((s) => (
                <div key={s.id} className="min-w-32 flex-1">
                  <StockBox large side={s.side} label={`At ${s.name}`} units={s.units(open)} />
                </div>
              ))}
              <DialogStat
                label={`Sold at ${names.demand}, 3 / 6 months`}
                value={`${formatNumber(open.demand[3])} / ${formatNumber(open.demand[6])}`}
              />
              <DialogStat label="Variations" value={formatNumber(open.rows.length)} />
            </>
          )}
          columns={({ set }) => [
            {
              id: 'atFrom',
              header: `At ${names.from}`,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <StockPill
                  side={names.requesting ? 'theirs' : 'mine'}
                  units={row.original.row.atSource}
                />
              ),
            },
            {
              id: 'atTo',
              header: `At ${names.to}`,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <StockPill
                  side={names.requesting ? 'mine' : 'theirs'}
                  units={row.original.row.atDestination}
                />
              ),
            },
            {
              id: 'sold',
              header: `Sold at ${names.demand}, 3 / 6 mo`,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <span className="text-fg-muted tabular-nums">
                  {formatNumber(row.original.row.demand[3])} /{' '}
                  <strong className="text-fg font-medium">
                    {formatNumber(row.original.row.demand[6])}
                  </strong>
                </span>
              ),
            },
            {
              id: 'move',
              header: 'Move',
              enableHiding: false,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <QuantityStepper
                  value={row.original.draft.quantity}
                  max={row.original.row.atSource}
                  label={row.original.row.variation.fullName}
                  onChange={(quantity) => set(row.original.row, { quantity })}
                />
              ),
            },
          ]}
        />
      )}
    />
  )
}
