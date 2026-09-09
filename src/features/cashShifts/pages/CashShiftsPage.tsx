import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Eye, Lock, Plus, Wallet } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { StatusChips } from '@/shared/components/StatusChips'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody } from '@/shared/ui/Card'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useCashShifts, useShiftCounts, type ShiftRow } from '../api/shifts'
import { shiftHours, type ShiftStatus } from '../model/shift'
import { VarianceBadge } from '../components/VarianceBadge'
import { OpenShiftModal } from '../components/OpenShiftModal'
import { CloseShiftModal } from '../components/CloseShiftModal'

/**
 * Cash shifts.
 *
 * Not a till — nothing is rung up here. A shift is the record of who had a
 * drawer, what went through it, and whether it balanced. The client asked for
 * «Кассовые смены» without a POS, and this is that: everything a cash-up needs
 * and none of the hardware.
 */
export default function CashShiftsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data } = useCashShifts({ search: query.search, status: query.status })
  const counts = useShiftCounts()

  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState<ShiftRow | null>(null)

  const openNow = data.items.filter((shift) => shift.status === 'open')
  const cashOnHand = openNow.reduce((sum, shift) => sum + shift.expected, 0)

  const columns = useMemo<TableColumn<ShiftRow>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Shift',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={paths.sales.shiftDetail(row.original.id)}
              className="text-fg font-medium hover:underline"
            >
              {row.original.number}
            </Link>
            <p className="text-fg-subtle text-2xs truncate">
              {row.original.registerName} · {row.original.locationName}
            </p>
          </div>
        ),
      },
      { accessorKey: 'employeeName', header: 'Who had it' },
      {
        accessorKey: 'openedAt',
        header: 'Opened',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>{formatDateTime(row.original.openedAt)}</p>
            <p className="text-fg-subtle text-2xs">
              {formatNumber(Math.round(shiftHours(row.original)))} h
              {row.original.status === 'open' ? ' and counting' : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'sales',
        header: 'Sales',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="tabular-nums">
            <p>{formatMoney(row.original.totals.cash)}</p>
            <p className="text-fg-subtle text-2xs">
              {formatNumber(row.original.totals.count)} in cash
            </p>
          </div>
        ),
      },
      {
        id: 'expected',
        header: 'Expected',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.expected)}</span>
        ),
      },
      {
        id: 'counted',
        header: 'Counted',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.countedCash === null ? (
            <span className="text-fg-subtle">—</span>
          ) : (
            <span className="tabular-nums">{formatMoney(row.original.countedCash)}</span>
          ),
      },
      {
        id: 'variance',
        header: 'Difference',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => <VarianceBadge difference={row.original.difference} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={row.original.status === 'open' ? 'info' : 'neutral'}>
            {row.original.status === 'open' ? 'Open' : 'Closed'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: 'Open shift',
                icon: Eye,
                onSelect: () => navigate(paths.sales.shiftDetail(row.original.id)),
              },
              {
                label: 'Close the drawer',
                icon: Lock,
                hidden: row.original.status !== 'open' || !can('sales.cashShifts.edit'),
                onSelect: () => setClosing(row.original),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  )

  return (
    <>
      <PageHeader
        title="Cash shifts"
        description="Who has a drawer, what went through it, and whether it balanced. Sales are still entered on New sale — this is the cash-up, not a till."
        action={
          can('sales.cashShifts.create') ? (
            <Button variant="primary" onClick={() => setOpening(true)}>
              <Plus />
              Open a shift
            </Button>
          ) : null
        }
      />

      {openNow.length > 0 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="text-fg-subtle size-4" />
              <div>
                <p className="text-fg text-sm font-medium">
                  {openNow.length === 1
                    ? `${openNow[0]!.registerName} is open`
                    : `${openNow.length} drawers are open`}
                </p>
                <p className="text-fg-subtle text-2xs">
                  {openNow.map((shift) => shift.employeeName).join(', ')}
                </p>
              </div>
            </div>
            {/* The figure a manager walks the floor with: what should be in
                the drawers right now, before anybody counts anything. */}
            <div>
              <p className="text-fg text-lg font-semibold tabular-nums">
                {formatMoney(cashOnHand)}
              </p>
              <p className="text-fg-subtle text-2xs">Cash that should be on hand</p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={(query.search as string) ?? ''}
          onChange={(search) => setQuery({ search })}
          placeholder="Search by shift, register or person…"
        />
        <StatusChips<ShiftStatus>
          ariaLabel="Filter by status"
          value={(query.status as ShiftStatus) ?? null}
          onChange={(status) => setQuery({ status })}
          counts={counts}
          options={[
            { value: null, label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
      </div>

      <DataTable
        storageKey="cash-shifts"
        columns={columns}
        data={data.items}
        total={data.total}
        isLoading={false}
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 20) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="No shifts yet"
            description="Open a drawer at the start of the day, and close it with a counted amount at the end."
          />
        }
      />

      <OpenShiftModal open={opening} onOpenChange={setOpening} />
      <CloseShiftModal
        shift={closing}
        open={closing !== null}
        onOpenChange={(next) => {
          if (!next) setClosing(null)
        }}
      />
    </>
  )
}
