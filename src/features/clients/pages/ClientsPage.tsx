import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Wallet, AlertTriangle, MoonStar, Building2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useClientCounts, useClients, useClientsSummary, type ClientRow } from '../api/clients'
import { clientStatusLabel, clientStatusTone, daysSinceLastSale } from '../model/client'

/**
 * Autoparks.
 *
 * The haulage companies Fura holds contracts with. For a parts business this
 * is a credit ledger with names on it, not a mailing list — ordered by what
 * they owe, because that is the row somebody has to act on.
 *
 * Individuals are not here. An owner-driver is a **driver**, and his purchases
 * are attributed to him rather than to an account.
 */
export default function ClientsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()

  /*
    Companies only. An autopark is a business by definition, so a person on
    this list would be somebody who cannot hold a contract — and the type
    filter that used to sit above the table now has one answer.
  */
  const filters = { search: query.search, type: 'business' as const, lens: query.lens }
  const { data, isLoading } = useClients(filters)
  const { data: counts } = useClientCounts(filters)
  const summary = useClientsSummary()

  const columns = useMemo<TableColumn<ClientRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Autopark',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-surface-inset text-fg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg truncate font-medium">{row.original.name}</p>
              <p className="text-fg-subtle text-2xs truncate tabular-nums">
                {row.original.phone ?? 'No phone'}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'debt',
        header: 'Owes us',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const { debt, creditLimit, headroom, overLimit } = row.original
          if (debt <= 0) {
            return <span className="text-fg-subtle">Nothing</span>
          }
          return (
            <div>
              <p className={`font-medium tabular-nums ${overLimit ? 'text-danger' : 'text-fg'}`}>
                {formatMoney(debt)}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {creditLimit === null
                  ? 'no account'
                  : overLimit
                    ? `${formatMoney(debt - creditLimit)} over limit`
                    : `${formatMoney(headroom ?? 0)} left`}
              </p>
            </div>
          )
        },
      },
      {
        id: 'creditLimit',
        header: 'Credit limit',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.creditLimit === null ? (
            // Different from a limit of zero, and the difference matters: one
            // pays up front, the other has an account they have used up.
            <span className="text-fg-subtle">Pays up front</span>
          ) : (
            <span className="tabular-nums">{formatMoney(row.original.creditLimit)}</span>
          ),
      },
      {
        id: 'bought',
        header: 'Bought',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) =>
          row.original.stats.sales === 0 ? (
            <span className="text-fg-subtle">Never</span>
          ) : (
            <div>
              <p className="text-fg tabular-nums">
                {formatMoney(Math.round(row.original.stats.revenue))}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {formatNumber(row.original.stats.sales)} sales
              </p>
            </div>
          ),
      },
      {
        id: 'lastSale',
        header: 'Last bought',
        enableHiding: false,
        cell: ({ row }) => {
          const days = daysSinceLastSale(row.original.stats)
          if (days === null) return <span className="text-fg-subtle">Never</span>
          const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
          return (
            <span className={row.original.dormant ? 'text-warning' : 'text-fg-muted'}>{label}</span>
          )
        },
      },
      {
        id: 'cashback',
        header: 'Cashback',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.cashback > 0 ? (
            <span className="tabular-nums">{formatMoney(row.original.cashback)}</span>
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={clientStatusTone(row.original.status)}>
            {clientStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Client since',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )

  const tiles = [
    {
      icon: Wallet,
      label: 'Owed to us',
      value: formatMoney(Math.round(summary.owed)),
      meta: `across ${formatNumber(summary.owing)} ${summary.owing === 1 ? 'autopark' : 'autoparks'}`,
      tone: summary.owed > 0 ? ('danger' as const) : undefined,
    },
    {
      icon: AlertTriangle,
      label: 'Over their limit',
      value: formatNumber(summary.overLimit),
      meta: 'owe more than they were allowed',
      tone: summary.overLimit > 0 ? ('danger' as const) : undefined,
    },
    {
      icon: MoonStar,
      label: 'Gone quiet',
      value: formatNumber(summary.dormant),
      meta: 'used to buy, have not in two months',
      tone: summary.dormant > 0 ? ('warning' as const) : undefined,
    },
  ]

  return (
    <>
      <PageHeader
        title="Autoparks"
        description="The haulage companies you hold contracts with — what they owe, how much account they have left, and whether they have stopped coming."
        action={
          can('marketing.clients.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.marketing.newAutopark}>
                <Plus />
                Add autopark
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Which autoparks to show"
              options={[
                { value: null, label: 'All' },
                { value: 'owing', label: 'Owe us' },
                { value: 'overLimit', label: 'Over limit' },
                { value: 'dormant', label: 'Gone quiet' },
              ]}
              value={(query.lens as string | null) ?? null}
              onChange={(lens) => setQuery({ lens, page: null })}
              counts={counts}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="flex items-start gap-3 p-4">
            <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <tile.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg-muted text-sm">{tile.label}</p>
              <p
                className={`mt-0.5 text-lg font-semibold ${
                  tile.tone === 'danger'
                    ? 'text-danger'
                    : tile.tone === 'warning'
                      ? 'text-warning'
                      : 'text-fg'
                }`}
              >
                {tile.value}
              </p>
              <p className="text-fg-subtle text-2xs">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="clients"
        columns={columns}
        initialHidden={['cashback', 'createdAt']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by name, phone or email…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(client) => navigate(paths.marketing.autoparkDetail(client.id))}
        emptyState={
          query.search || query.lens || query.type ? (
            <EmptyState title="Nobody matches these filters" />
          ) : (
            <EmptyState
              title="No clients yet"
              description="Add the garages and buyers you sell to. A sale can then be put on their account rather than paid up front."
              action={
                can('marketing.clients.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.marketing.newAutopark}>
                      <Plus />
                      Add client
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />
    </>
  )
}
