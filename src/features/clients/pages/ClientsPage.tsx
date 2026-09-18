import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Building2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { CLIENT_FILTER_OVERRIDES } from '../model/clientFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useClientCounts, useClients, type ClientRow } from '../api/clients'
import { clientStatusLabel, clientStatusTone, daysSinceLastSale } from '../model/client'
import { t } from '@/shared/i18n'

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
/** Every autopark, unfiltered — the search panel reads its pick-lists from these. */
const EVERY_BUSINESS = { type: 'business' as const }

export default function ClientsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data: everyClient } = useClients(EVERY_BUSINESS)

  /*
    Companies only. An autopark is a business by definition, so a person on
    this list would be somebody who cannot hold a contract — and the type
    filter that used to sit above the table now has one answer.
  */
  const filters = { f: query.f, search: query.search, type: 'business' as const, lens: query.lens }
  const { data, isLoading } = useClients(filters)
  const { data: counts } = useClientCounts(filters)

  const columns = useMemo<TableColumn<ClientRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Autopark'),
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-surface-inset text-fg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg truncate font-medium">{row.original.name}</p>
              <p className="text-fg-subtle text-2xs truncate tabular-nums">
                {row.original.phone ?? t('No phone')}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'debt',
        header: t('Owes us'),
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const { debt, creditLimit, headroom, overLimit } = row.original
          if (debt <= 0) {
            return <span className="text-fg-subtle">{t('Nothing')}</span>
          }
          return (
            <div>
              <p className={`font-medium tabular-nums ${overLimit ? 'text-danger' : 'text-fg'}`}>
                {formatMoney(debt)}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {creditLimit === null
                  ? t('no account')
                  : overLimit
                    ? t('{p0} over limit', { p0: formatMoney(debt - creditLimit) })
                    : t('{p0} left', { p0: formatMoney(headroom ?? 0) })}
              </p>
            </div>
          )
        },
      },
      {
        id: 'creditLimit',
        header: t('Credit limit'),
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.creditLimit === null ? (
            // Different from a limit of zero, and the difference matters: one
            // pays up front, the other has an account they have used up.
            <span className="text-fg-subtle">{t('Pays up front')}</span>
          ) : (
            <span className="tabular-nums">{formatMoney(row.original.creditLimit)}</span>
          ),
      },
      {
        id: 'bought',
        header: t('Bought'),
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) =>
          row.original.stats.sales === 0 ? (
            <span className="text-fg-subtle">{t('Never')}</span>
          ) : (
            <div>
              <p className="text-fg tabular-nums">
                {formatMoney(Math.round(row.original.stats.revenue))}
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {formatNumber(row.original.stats.sales)} {t('sales')}
              </p>
            </div>
          ),
      },
      {
        id: 'lastSale',
        header: t('Last bought'),
        enableHiding: false,
        cell: ({ row }) => {
          const days = daysSinceLastSale(row.original.stats)
          if (days === null) return <span className="text-fg-subtle">{t('Never')}</span>
          const label =
            days === 0 ? t('Today') : days === 1 ? t('Yesterday') : t('{days} days ago', { days })
          return (
            <span className={row.original.dormant ? 'text-warning' : 'text-fg-muted'}>{label}</span>
          )
        },
      },
      {
        id: 'cashback',
        header: t('Cashback'),
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
        header: t('Status'),
        cell: ({ row }) => (
          <Badge tone={clientStatusTone(row.original.status)}>
            {clientStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('Client since'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title={t('Autoparks')}
        description={t(
          'The haulage companies you hold contracts with — what they owe, how much account they have left, and whether they have stopped coming.',
        )}
        action={
          can('users.autoparks.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.users.newAutopark}>
                <Plus />
                {t('Add autopark')}
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel={t('Which autoparks to show')}
              options={[
                { value: null, label: t('All') },
                { value: 'owing', label: t('Owe us') },
                { value: 'overLimit', label: t('Over limit') },
                { value: 'dormant', label: t('Gone quiet') },
              ]}
              value={(query.lens as string | null) ?? null}
              onChange={(lens) => setQuery({ lens, page: null })}
              counts={counts}
            />
          </div>
        }
      />

      <DataTable
        storageKey="clients"
        columns={columns}
        initialHidden={['cashback', 'createdAt']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={everyClient.items}
            overrides={CLIENT_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(client) => navigate(paths.users.autoparkDetail(client.id))}
        emptyState={
          query.search || query.f || query.lens || query.type ? (
            <EmptyState title={t('Nobody matches these filters')} />
          ) : (
            <EmptyState
              title={t('No clients yet')}
              description={t(
                'Add the garages and buyers you sell to. A sale can then be put on their account rather than paid up front.',
              )}
              action={
                can('users.autoparks.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.users.newAutopark}>
                      <Plus />
                      {t('Add client')}
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
