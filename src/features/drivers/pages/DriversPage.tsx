import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { IdCard, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { StatusChips } from '@/shared/components/StatusChips'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Field } from '@/shared/components/Field'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { useDriverActions, useDriverCounts, useDrivers } from '../api/drivers'
import {
  DRIVER_STATUSES,
  driverSchema,
  type Driver,
  type DriverDraft,
  type DriverStatus,
} from '../model/driver'

const EMPTY: DriverDraft = {
  fullName: '',
  phone: null,
  clientId: null,
  vehiclePlate: null,
  licenceNumber: null,
  comment: null,
  status: 'active',
}

/**
 * Drivers.
 *
 * Who turns up at the counter for the haulage companies. The company is the
 * client — it holds the account and the debt — but a client record cannot say
 * *which of their people* came in, and that is the name a parts counter
 * actually deals with.
 *
 * A driver buys nothing on their own account: the discount belongs to the
 * company, set on the promotion that targets them.
 */
export default function DriversPage() {
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data } = useDrivers({ search: query.search, status: query.status })
  const counts = useDriverCounts()
  const actions = useDriverActions()
  const clients = useDataStore((s) => s.clients)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [deleting, setDeleting] = useState<Driver | null>(null)
  const [draft, setDraft] = useState<DriverDraft>(EMPTY)
  const [showErrors, setShowErrors] = useState(false)

  const parsed = driverSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (driver: Driver | null) => {
    setEditing(driver)
    setDraft(
      driver
        ? {
            fullName: driver.fullName,
            phone: driver.phone,
            clientId: driver.clientId,
            vehiclePlate: driver.vehiclePlate,
            licenceNumber: driver.licenceNumber,
            comment: driver.comment,
            status: driver.status,
          }
        : EMPTY,
    )
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    if (editing) actions.update(editing.id, parsed.data)
    else actions.create(parsed.data)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${draft.fullName} added`)
  }

  const columns = useMemo<TableColumn<Driver>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Driver',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate font-medium">{row.original.fullName}</p>
            <p className="text-fg-subtle text-2xs truncate">{row.original.phone ?? 'No phone'}</p>
          </div>
        ),
      },
      {
        id: 'client',
        header: 'Drives for',
        enableHiding: false,
        cell: ({ row }) =>
          row.original.clientId ? (
            // The link is what stops this being a dead list: from a driver to
            // the company's account, debt and history in one click.
            <Link
              to={paths.marketing.clientDetail(row.original.clientId)}
              className="text-fg hover:underline"
            >
              {row.original.clientName}
            </Link>
          ) : (
            <span className="text-fg-subtle">Owner-driver</span>
          ),
      },
      {
        accessorKey: 'vehiclePlate',
        header: 'Truck',
        cell: ({ row }) =>
          row.original.vehiclePlate ? (
            <span className="font-mono text-xs">{row.original.vehiclePlate}</span>
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        accessorKey: 'licenceNumber',
        header: 'Licence',
        cell: ({ row }) => (
          <span className="text-fg-muted font-mono text-xs">
            {row.original.licenceNumber ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={row.original.status === 'active' ? 'success' : 'neutral'}>
            {row.original.status === 'active' ? 'Driving' : 'No longer driving'}
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
                label: 'Edit',
                icon: Pencil,
                hidden: !can('marketing.drivers.edit'),
                onSelect: () => openFor(row.original),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                hidden: !can('marketing.drivers.delete'),
                onSelect: () => setDeleting(row.original),
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
        title="Drivers"
        description="Who turns up at the counter for the companies you sell to. The account stays with the company; this is the person."
        action={
          can('marketing.drivers.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              Add driver
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={(query.search as string) ?? ''}
          onChange={(search) => setQuery({ search })}
          placeholder="Search by name, phone, company or plate…"
        />
        <StatusChips<DriverStatus>
          ariaLabel="Filter by status"
          value={(query.status as DriverStatus) ?? null}
          onChange={(status) => setQuery({ status })}
          counts={counts}
          options={[{ value: null, label: 'All' }, ...DRIVER_STATUSES]}
        />
      </div>

      <DataTable
        storageKey="drivers"
        columns={columns}
        data={data.items}
        total={data.total}
        isLoading={false}
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 20) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        emptyState={
          <EmptyState
            icon={Truck}
            title="No drivers yet"
            description="Add the people who collect parts for your fleet customers."
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.fullName}` : 'New driver'}
        primary={{ label: editing ? 'Save changes' : 'Add driver', onClick: save }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required error={errors.fullName?.[0]} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                placeholder="Bekzod Normatov"
                value={draft.fullName}
                onChange={(event) => setDraft((c) => ({ ...c, fullName: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Phone">
            {(p) => (
              <Input
                {...p}
                placeholder="+998 90 123 45 67"
                value={draft.phone ?? ''}
                onChange={(event) => setDraft((c) => ({ ...c, phone: event.target.value || null }))}
              />
            )}
          </Field>
          <Field label="Truck" hint="Number plate">
            {(p) => (
              <Input
                {...p}
                placeholder="01 A 123 AA"
                value={draft.vehiclePlate ?? ''}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, vehiclePlate: event.target.value || null }))
                }
              />
            )}
          </Field>
          <Field label="Drives for" hint="Leave empty for an owner-driver">
            {(p) => (
              <Select
                {...p}
                className="w-full"
                placeholder="Owner-driver"
                value={draft.clientId ?? undefined}
                onChange={(clientId) => setDraft((c) => ({ ...c, clientId: clientId || null }))}
                options={clients
                  .filter((client) => client.type === 'business' && client.status === 'active')
                  .map((client) => ({ value: client.id, label: client.name }))}
              />
            )}
          </Field>
          <Field label="Status">
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={draft.status}
                onChange={(status) => setDraft((c) => ({ ...c, status: status as DriverStatus }))}
                options={DRIVER_STATUSES}
              />
            )}
          </Field>
          <Field label="Licence number" className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={draft.licenceNumber ?? ''}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, licenceNumber: event.target.value || null }))
                }
              />
            )}
          </Field>
          <Field label="Note" className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={draft.comment ?? ''}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, comment: event.target.value || null }))
                }
              />
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.fullName}?`}
        body="The company's sales are unaffected — a driver is a contact, not an account."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          actions.remove(deleting.id)
          setDeleting(null)
          toast.success('Driver deleted')
        }}
      />

      {data.total === 0 ? null : (
        <p className="text-fg-subtle text-2xs flex items-center gap-1.5">
          <IdCard className="size-3.5" />
          Discounts belong to the company, not the driver — set them on a promotion under “Who gets
          it”.
        </p>
      )}
    </>
  )
}
