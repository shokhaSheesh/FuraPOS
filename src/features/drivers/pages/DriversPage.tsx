import { VehicleMakeSelect, VehicleModelSelect } from '@/shared/components/VehicleSelects'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { DRIVER_FILTER_OVERRIDES } from '../model/driverFilterFields'
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
import { t } from '@/shared/i18n'

const EMPTY: DriverDraft = {
  fullName: '',
  phone: null,
  ownTrucks: [],
  autoparkId: null,
  autoparkTruck: null,
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
  const { data: everyDriver } = useDrivers({ section })
  const { data } = useDrivers({ search: query.search, section, status: query.status, f: query.f })
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
            ownTrucks: driver.ownTrucks,
            autoparkId: driver.autoparkId,
            autoparkTruck: driver.autoparkTruck,
            comment: driver.comment,
            status: driver.status,
          }
        : EMPTY,
    )
    setShowErrors(false)
    setOpen(true)
  }

  const setOwnTruck = (index: number, patch: Partial<DriverDraft['ownTrucks'][number]>) =>
    setDraft((c) => ({
      ...c,
      ownTrucks: c.ownTrucks.map((truck, i) => (i === index ? { ...truck, ...patch } : truck)),
    }))

  const addOwnTruck = () =>
    setDraft((c) => ({ ...c, ownTrucks: [...c.ownTrucks, { plate: '', make: null, model: null }] }))

  const removeOwnTruck = (index: number) =>
    setDraft((c) => ({ ...c, ownTrucks: c.ownTrucks.filter((_, i) => i !== index) }))

  /** The autopark's one truck, patched field by field like his own. */
  const setAutoparkTruck = (patch: Partial<DriverDraft['ownTrucks'][number]>) =>
    setDraft((c) => ({
      ...c,
      autoparkTruck: { plate: '', make: null, model: null, ...c.autoparkTruck, ...patch },
    }))

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    if (editing) actions.update(editing.id, parsed.data)
    else actions.create(parsed.data)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${draft.fullName} added`)
  }

  const columns = useMemo<TableColumn<Driver>[]>(() => {
    const plates = (driver: Driver) => trucksFor(driver, capacityOfSection(section))
    const all: TableColumn<Driver>[] = [
      {
        accessorKey: 'fullName',
        header: t('Driver'),
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={paths.users.driverDetail(row.original.id)}
              className="text-fg truncate font-medium hover:underline"
            >
              {row.original.fullName}
            </Link>
            <p className="text-fg-subtle text-2xs truncate">
              <span className="font-mono">{row.original.code}</span>
              {row.original.phone ? ` · ${row.original.phone}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'autopark',
        header: t('Autopark'),
        enableHiding: false,
        cell: ({ row }) =>
          row.original.autoparkId ? (
            // From a driver to the company that holds the contract, the debt
            // and the promotion — in one click.
            <Link
              to={paths.users.autoparkDetail(row.original.autoparkId)}
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
        header: t('Trucks'),
        enableHiding: false,
        // Only the trucks belonging to this tab. A man's own lorry shown
        // under his autopark — or theirs shown under him — reads as the
        // company owning a truck it has never seen.
        cell: ({ row }) => (
          <div className="space-y-0.5">
            {plates(row.original).map((truck) => (
              <p key={truck.plate} className="font-mono text-xs">
                {truck.plate}
              </p>
            ))}
          </div>
        ),
      },
      {
        id: 'make',
        header: t('Make'),
        enableHiding: false,
        // Stacked in the same order as the plates beside them, so a driver
        // with two lorries reads across rather than down.
        cell: ({ row }) => (
          <div className="space-y-0.5">
            {plates(row.original).map((truck) => (
              <p key={truck.plate} className="text-xs">
                {truck.make ?? <span className="text-fg-subtle">—</span>}
              </p>
            ))}
          </div>
        ),
      },
      {
        id: 'model',
        header: t('Model'),
        enableHiding: false,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            {plates(row.original).map((truck) => (
              <p key={truck.plate} className="text-xs">
                {truck.model ?? <span className="text-fg-subtle">—</span>}
              </p>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => (
          <Badge tone={row.original.status === 'active' ? 'success' : 'neutral'}>
            {row.original.status === 'active' ? t('Driving') : t('No longer driving')}
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
                label: t('Edit'),
                icon: Pencil,
                hidden: !can('users.drivers.edit'),
                onSelect: () => openFor(row.original),
              },
              {
                label: t('Delete'),
                icon: Trash2,
                destructive: true,
                hidden: !can('users.drivers.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ]

    // An owner-driver has no autopark, so the column is nothing but dashes
    // in that tab.
    return section === 'independent' ? all.filter((column) => column.id !== 'autopark') : all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, section])

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
          title={t('No drivers here')}
          description={t(
            'Add the people who collect parts — owner-drivers, and the drivers of the autoparks you have contracts with.',
          )}
        />
      }
    />
  )

  return (
    <>
      <PageHeader
        title={t('Drivers')}
        description={t(
          "Who collects parts at the counter. Scanning a driver puts the purchase in his own app, and on the right truck in his autopark's.",
        )}
        action={
          can('users.drivers.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              {t('Add driver')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ColumnFilterSearch
          columns={columns}
          rows={everyDriver.items}
          overrides={DRIVER_FILTER_OVERRIDES}
          query={query}
          setQuery={setQuery}
        />
        <Select
          className="w-44"
          aria-label={t('Filter by status')}
          placeholder={t('Any status')}
          value={(query.status as string) || undefined}
          onChange={(status) => setQuery({ status })}
          options={[{ value: '', label: t('Any status') }, ...DRIVER_STATUSES]}
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
        title={editing ? t('Edit {fullName}', { fullName: editing.fullName }) : t('New driver')}
        description={t("A driver buys for his own truck, for an autopark's, or both.")}
        primary={{ label: editing ? 'Save changes' : 'Add driver', onClick: save }}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('Name')}
              required
              error={errors.fullName?.[0]}
              className="sm:col-span-2"
            >
              {(p) => (
                <Input
                  {...p}
                  placeholder={t('Bekzod Normatov')}
                  value={draft.fullName}
                  onChange={(event) => setDraft((c) => ({ ...c, fullName: event.target.value }))}
                />
              )}
            </Field>
            <Field label={t('Phone')}>
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
          </div>

          <div className="border-border rounded-card space-y-3 border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-fg text-sm font-medium">{t('His own trucks')}</p>
              <Button type="button" variant="secondary" size="sm" onClick={addOwnTruck}>
                <Plus />
                {t('Add truck')}
              </Button>
            </div>
            {draft.ownTrucks.length === 0 ? (
              <p className="text-fg-subtle text-2xs">
                {t('None — leave it so if he only drives for an autopark.')}
              </p>
            ) : (
              <div className="space-y-2">
                {/* Captioned once rather than per row: three labelled inputs
                    repeated five times is a wall of text. */}
                <div className="text-fg-subtle text-2xs grid gap-2 pr-10 sm:grid-cols-3">
                  <span>{t('Number plate')}</span>
                  <span>{t('Make')}</span>
                  <span>{t('Model')}</span>
                </div>
                {draft.ownTrucks.map((truck, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-3">
                      <Input
                        aria-label={t('Number plate {p0}', { p0: index + 1 })}
                        placeholder={t('40 E 678 HH')}
                        value={truck.plate}
                        onChange={(event) => setOwnTruck(index, { plate: event.target.value })}
                      />
                      <VehicleMakeSelect
                        aria-label={t('Make {p0}', { p0: index + 1 })}
                        value={truck.make}
                        // A model belongs to one brand, so a new brand clears it.
                        onChange={(make) => setOwnTruck(index, { make, model: null })}
                      />
                      <VehicleModelSelect
                        aria-label={t('Model {p0}', { p0: index + 1 })}
                        make={truck.make}
                        value={truck.model}
                        onChange={(model) => setOwnTruck(index, { model })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('Remove truck {p0}', { p0: index + 1 })}
                      onClick={() => removeOwnTruck(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.ownTrucks?.[0] ? (
              <p className="text-danger text-2xs">{errors.ownTrucks[0]}</p>
            ) : null}
          </div>

          <div className="border-border rounded-card space-y-3 border p-3">
            <p className="text-fg text-sm font-medium">{t('Autopark')}</p>
            <Field label={t('Company')} hint={t('Leave empty for an owner-driver')}>
              {(p) => (
                <Select
                  {...p}
                  className="w-full"
                  placeholder={t('None')}
                  value={draft.autoparkId ?? undefined}
                  onChange={(autoparkId) =>
                    setDraft((c) => ({
                      ...c,
                      autoparkId: autoparkId || null,
                      // Their truck belongs to them: clearing the company has
                      // to clear the truck, or it would be attributed to a
                      // company he no longer drives for.
                      autoparkTruck: autoparkId ? c.autoparkTruck : null,
                    }))
                  }
                  options={autoparks}
                />
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label={t('Their truck')}
                required={draft.autoparkId !== null}
                error={errors.autoparkTruck?.[0]}
              >
                {(p) => (
                  <Input
                    {...p}
                    placeholder={t('01 A 123 AA')}
                    disabled={draft.autoparkId === null}
                    value={draft.autoparkTruck?.plate ?? ''}
                    onChange={(event) => setAutoparkTruck({ plate: event.target.value })}
                  />
                )}
              </Field>
              <Field label={t('Make')}>
                {(p) => (
                  <VehicleMakeSelect
                    id={p.id}
                    disabled={draft.autoparkId === null}
                    value={draft.autoparkTruck?.make ?? null}
                    onChange={(make) => setAutoparkTruck({ make, model: null })}
                  />
                )}
              </Field>
              <Field label={t('Model')}>
                {() => (
                  <VehicleModelSelect
                    disabled={draft.autoparkId === null}
                    make={draft.autoparkTruck?.make ?? null}
                    value={draft.autoparkTruck?.model ?? null}
                    onChange={(model) => setAutoparkTruck({ model })}
                  />
                )}
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Status')}>
              {(p) => (
                <Select
                  {...p}
                  className="w-full"
                  value={draft.status}
                  onChange={(status) => setDraft((c) => ({ ...c, status: status as DriverStatus }))}
                  options={DRIVER_STATUSES.map((option) => ({ ...option, label: t(option.label) }))}
                />
              )}
            </Field>
            <Field label={t('Note')}>
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
        title={t('Delete {fullName}?', { fullName: deleting?.fullName })}
        body="Sales he collected keep his name — a driver is a contact, not an account."
        confirmLabel={t('Delete')}
        destructive
        onConfirm={() => {
          if (!deleting) return
          actions.remove(deleting.id)
          setDeleting(null)
          toast.success(t('Driver deleted'))
        }}
      />
    </>
  )
}
