import { useMemo, useState } from 'react'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { LOCATION_KINDS, locationSchema, type LocationSettings } from '../model/settings'

/**
 * Locations.
 *
 * The most load-bearing list in Settings: stock is held per location, and
 * transfers, receipts, corrections, stocktakes and sales all point at one. The
 * "holds" column is there so nobody deletes a shelf with parts on it — and the
 * store refuses anyway.
 */
export default function LocationsSettingsPage() {
  const { can } = useSession()
  const locations = useDataStore((s) => s.locationSettings)
  const variations = useDataStore((s) => s.variations)
  const create = useDataStore((s) => s.createLocation)
  const update = useDataStore((s) => s.updateLocation)
  const remove = useDataStore((s) => s.deleteLocation)

  const [editing, setEditing] = useState<LocationSettings | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    kind: 'shop' as LocationSettings['kind'],
    address: '',
    areaSqm: null as number | null,
    active: true,
  })
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<LocationSettings | null>(null)

  const held = useMemo(() => {
    const map = new Map<string, { units: number; value: number }>()
    for (const variation of variations) {
      const cost =
        variation.costCurrency === 'USD' ? variation.costPrice * USD_RATE : variation.costPrice
      for (const row of variation.stockByLocation) {
        const entry = map.get(row.locationId) ?? { units: 0, value: 0 }
        entry.units += row.quantity
        entry.value += row.quantity * cost
        map.set(row.locationId, entry)
      }
    }
    return map
  }, [variations])

  const parsed = locationSchema.safeParse({ ...draft, address: draft.address || null })
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (location: LocationSettings | null) => {
    setEditing(location)
    setDraft({
      name: location?.name ?? '',
      kind: location?.kind ?? 'shop',
      address: location?.address ?? '',
      areaSqm: location?.areaSqm ?? null,
      active: location?.active ?? true,
    })
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    const input = { ...draft, address: draft.address || null }
    if (editing) update(editing.id, input)
    else create(input)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${draft.name} added`)
  }

  const columns = useMemo<TableColumn<LocationSettings>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Location',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg truncate font-medium">{row.original.name}</p>
            <p className="text-fg-subtle text-2xs truncate">
              {row.original.address ?? 'No address'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'kind',
        header: 'Type',
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone="neutral">
            {LOCATION_KINDS.find((k) => k.value === row.original.kind)?.label ?? row.original.kind}
          </Badge>
        ),
      },
      {
        id: 'holds',
        header: 'Holds',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const entry = held.get(row.original.id)
          if (!entry || entry.units === 0) return <span className="text-fg-subtle">Empty</span>
          return (
            <div>
              <p className="text-fg tabular-nums">{formatNumber(entry.units)} units</p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {formatMoney(Math.round(entry.value))} at cost
              </p>
            </div>
          )
        },
      },
      {
        accessorKey: 'areaSqm',
        header: 'Area',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.areaSqm === null ? (
            <span className="text-fg-subtle">—</span>
          ) : (
            <span className="tabular-nums">{formatNumber(row.original.areaSqm)} m²</span>
          ),
      },
      {
        accessorKey: 'active',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={row.original.active ? 'success' : 'neutral'}>
            {row.original.active ? 'Open' : 'Closed'}
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
                hidden: !can('settings.locations.edit'),
                onSelect: () => openFor(row.original),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                hidden: !can('settings.locations.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, held],
  )

  return (
    <>
      <PageHeader
        title="Locations"
        description="Every warehouse and shop. Stock is counted per location, so this list is what transfers move between and what a stocktake counts."
        action={
          can('settings.locations.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              Add location
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey="settings-locations"
        columns={columns}
        data={locations}
        total={locations.length}
        isLoading={false}
        pagination={{ page: 1, pageSize: 50 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            description="Stock has to live somewhere — add a warehouse or a shop."
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : 'New location'}
        primary={{ label: editing ? 'Save changes' : 'Add location', onClick: save }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                placeholder="Shop — Chilonzor"
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Type">
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={draft.kind}
                onChange={(kind) => setDraft((c) => ({ ...c, kind }))}
                options={LOCATION_KINDS}
              />
            )}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                placeholder="Ташкент, ул. …"
                value={draft.address}
                onChange={(event) => setDraft((c) => ({ ...c, address: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Area" hint="In m², if it is worth recording">
            {(p) => (
              <NumberField
                {...p}
                className="w-full"
                min={0}
                placeholder="Not recorded"
                value={draft.areaSqm}
                onChange={(areaSqm) => setDraft((c) => ({ ...c, areaSqm }))}
              />
            )}
          </Field>
          <Field label="Open">
            {() => (
              <div className="flex h-9 items-center">
                <Switch
                  aria-label="Open"
                  checked={draft.active}
                  onCheckedChange={(active) => setDraft((c) => ({ ...c, active }))}
                />
              </div>
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="Documents that mention it keep the name they were saved with. A location still holding stock cannot be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          const result = remove(deleting.id)
          setDeleting(null)
          if (result.ok) toast.success('Location deleted')
          else toast.error(result.error)
        }}
      />
    </>
  )
}
