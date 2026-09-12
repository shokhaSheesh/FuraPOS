import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { Tabs } from '@/shared/ui/Tabs'
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
import { formatNumber } from '@/shared/lib/format'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { useDriverActions, useDriverCounts, useDrivers } from '../api/drivers'
import {
  DRIVER_SECTIONS,
  DRIVER_STATUSES,
  capacityOfSection,
  driverSchema,
  trucksFor,
  type Driver,
  type DriverDraft,
  type DriverStatus,
} from '../model/driver'

const EMPTY: DriverDraft = {
  fullName: '',
  phone: null,
  licenceNumber: null,
  ownTruckPlates: [],
  autoparkId: null,
  autoparkTruckPlate: null,
  comment: null,
  status: 'active',
}

/**
 * Drivers.
 *
 * Split into the two sections the business actually thinks in — owner-drivers
 * and autopark drivers — with the important wrinkle that **a driver can be
 * both**, and those appear in each. He buys for himself some days and on his
 * company's contract on others, and the counter asks which at the till.
 */
export default function DriversPage() {
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  // The list is always one section or the other — there is no combined view,
  // because "all drivers" is not a group anybody sells to.
  const section = (query.section as 'independent' | 'autopark') ?? 'independent'
  const { data } = useDrivers({ search: query.search, section, status: query.status })
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
            licenceNumber: driver.licenceNumber,
            ownTruckPlates: driver.ownTruckPlates,
            autoparkId: driver.autoparkId,
            autoparkTruckPlate: driver.autoparkTruckPlate,
            comment: driver.comment,
            status: driver.status,
          }
        : EMPTY,
    )
    setShowErrors(false)
    setOpen(true)
  }

  const setOwnTruck = (index: number, value: string) =>
    setDraft((c) => ({
      ...c,
      ownTruckPlates: c.ownTruckPlates.map((plate, i) => (i === index ? value : plate)),
    }))

  const addOwnTruck = () => setDraft((c) => ({ ...c, ownTruckPlates: [...c.ownTruckPlates, ''] }))

  const removeOwnTruck = (index: number) =>
    setDraft((c) => ({ ...c, ownTruckPlates: c.ownTruckPlates.filter((_, i) => i !== index) }))

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
            <p className="text-fg-subtle text-2xs truncate">
              <span className="font-mono">{row.original.code}</span>
              {row.original.phone ? ` · ${row.original.phone}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'autopark',
        header: 'Autopark',
        enableHiding: false,
        cell: ({ row }) =>
          row.original.autoparkId ? (
            // From a driver to the company that holds the contract, the debt
            // and the promotion — in one click.
            <Link
              to={paths.marketing.clientDetail(row.original.autoparkId)}
              className="text-fg hover:underline"
            >
              {row.original.autoparkName}
            </Link>
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        id: 'trucks',
        header: 'Trucks',
        enableHiding: false,
        // Only the trucks belonging to this tab. A man's own lorry shown
        // under his autopark — or theirs shown under him — reads as the
        // company owning a truck it has never seen.
        cell: ({ row }) => (
          <div className="space-y-0.5">
            {trucksFor(row.original, capacityOfSection(section)).map((plate) => (
              <p key={plate} className="font-mono text-xs">
                {plate}
              </p>
            ))}
          </div>
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
    [can, section],
  )

  const autoparks = clients
    .filter((client) => client.type === 'business' && client.status === 'active')
    .map((client) => ({ value: client.id, label: client.name }))

  const table = (
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
          title="No drivers here"
          description="Add the people who collect parts — owner-drivers, and the drivers of the autoparks you have contracts with."
        />
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Who collects parts at the counter. Scanning a driver puts the purchase in his own app, and on the right truck in his autopark's."
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
          placeholder="Search by name, code, phone or plate…"
        />
        <Select
          className="w-44"
          aria-label="Filter by status"
          placeholder="Any status"
          value={(query.status as string) || undefined}
          onChange={(status) => setQuery({ status })}
          options={[{ value: '', label: 'Any status' }, ...DRIVER_STATUSES]}
        />
      </div>

      <Tabs
        value={section}
        // Switching tab drops the page, so tab two never opens on page 3 of
        // a list that is only one page long.
        onValueChange={(next) => setQuery({ section: next })}
        items={DRIVER_SECTIONS.map((entry) => ({
          value: entry.value,
          label: entry.label,
          badge: formatNumber(counts[entry.value]),
          // Deliberately the same table in both tabs: the tab chooses the
          // filter, so building a second one would only let them drift.
          content: table,
        }))}
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.fullName}` : 'New driver'}
        description="A driver buys for his own truck, for an autopark's, or both."
        primary={{ label: editing ? 'Save changes' : 'Add driver', onClick: save }}
      >
        <div className="space-y-4">
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
                  onChange={(event) =>
                    setDraft((c) => ({ ...c, phone: event.target.value || null }))
                  }
                />
              )}
            </Field>
            <Field label="Licence number">
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
          </div>

          <div className="border-border rounded-card space-y-3 border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-fg text-sm font-medium">His own trucks</p>
              <Button type="button" variant="secondary" size="sm" onClick={addOwnTruck}>
                <Plus />
                Add truck
              </Button>
            </div>
            {draft.ownTruckPlates.length === 0 ? (
              <p className="text-fg-subtle text-2xs">
                None — leave it so if he only drives for an autopark.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.ownTruckPlates.map((plate, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      aria-label={`Number plate ${index + 1}`}
                      placeholder="40 E 678 HH"
                      value={plate}
                      onChange={(event) => setOwnTruck(index, event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove truck ${index + 1}`}
                      onClick={() => removeOwnTruck(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.ownTruckPlates?.[0] ? (
              <p className="text-danger text-2xs">{errors.ownTruckPlates[0]}</p>
            ) : null}
          </div>

          <div className="border-border rounded-card space-y-3 border p-3">
            <p className="text-fg text-sm font-medium">Autopark</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company" hint="Leave empty for an owner-driver">
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    placeholder="None"
                    value={draft.autoparkId ?? undefined}
                    onChange={(autoparkId) =>
                      setDraft((c) => ({
                        ...c,
                        autoparkId: autoparkId || null,
                        // Their truck belongs to them: clearing the company
                        // has to clear the plate, or it would be attributed to
                        // a company he no longer drives for.
                        autoparkTruckPlate: autoparkId ? c.autoparkTruckPlate : null,
                      }))
                    }
                    options={autoparks}
                  />
                )}
              </Field>
              <Field
                label="Their truck"
                required={draft.autoparkId !== null}
                error={errors.autoparkTruckPlate?.[0]}
              >
                {(p) => (
                  <Input
                    {...p}
                    placeholder="01 A 123 AA"
                    disabled={draft.autoparkId === null}
                    value={draft.autoparkTruckPlate ?? ''}
                    onChange={(event) =>
                      setDraft((c) => ({
                        ...c,
                        autoparkTruckPlate: event.target.value || null,
                      }))
                    }
                  />
                )}
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
            <Field label="Note">
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
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.fullName}?`}
        body="Sales he collected keep his name — a driver is a contact, not an account."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          actions.remove(deleting.id)
          setDeleting(null)
          toast.success('Driver deleted')
        }}
      />
    </>
  )
}
