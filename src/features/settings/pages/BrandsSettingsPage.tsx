import { useMemo, useState } from 'react'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Field } from '@/shared/components/Field'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Switch } from '@/shared/ui/Switch'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Tabs } from '@/shared/ui/Tabs'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { brandSchema, type Brand, type VehicleMake } from '../model/settings'
import { TruckBrandsPanel } from '../components/TruckBrandsPanel'
import { t } from '@/shared/i18n'

/**
 * Brands — two lists that are easy to confuse, kept apart by a tab.
 *
 *   - **Part brands** make the part: Bosch, Denso. A product points at one.
 *   - **Truck brands** make the lorry it fits: DAF, MAN — each with its models.
 *     A product says which of them it fits, and a driver's truck is one.
 *
 * A settings screen rather than a module because nobody opens it twice a week.
 */
export default function BrandsSettingsPage() {
  const { can } = useSession()
  const brands = useDataStore((s) => s.brandSettings)
  const variations = useDataStore((s) => s.variations)
  const create = useDataStore((s) => s.createBrand)
  const update = useDataStore((s) => s.updateBrand)
  const remove = useDataStore((s) => s.deleteBrand)

  const [editing, setEditing] = useState<Brand | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', zone: '', active: true })
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<Brand | null>(null)
  const [tab, setTab] = useState<'parts' | 'trucks'>('parts')

  const vehicleMakes = useDataStore((s) => s.vehicleMakes)
  const createMake = useDataStore((s) => s.createVehicleMake)
  const renameMake = useDataStore((s) => s.renameVehicleMake)
  const [makeDialog, setMakeDialog] = useState<{ make: VehicleMake | null } | null>(null)
  const [makeName, setMakeName] = useState('')

  const openMake = (make: VehicleMake | null) => {
    setMakeName(make?.name ?? '')
    setMakeDialog({ make })
  }

  const saveMake = () => {
    const editing = makeDialog?.make ?? null
    const result = editing ? renameMake(editing.id, makeName) : createMake(makeName)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      editing ? 'Renamed everywhere it is used' : `${makeName.trim()} added — now add its models`,
    )
    setMakeDialog(null)
  }

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const variation of variations) {
      if (!variation.brandId) continue
      map.set(variation.brandId, (map.get(variation.brandId) ?? 0) + 1)
    }
    return map
  }, [variations])

  const parsed = brandSchema.safeParse({ ...draft, zone: draft.zone || null })
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (brand: Brand | null) => {
    setEditing(brand)
    setDraft({ name: brand?.name ?? '', zone: brand?.zone ?? '', active: brand?.active ?? true })
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    const input = { ...draft, zone: draft.zone || null }
    if (editing) update(editing.id, input)
    else create(input)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${draft.name} added`)
  }

  const columns = useMemo<TableColumn<Brand>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Brand'),
        enableHiding: false,
        cell: ({ row }) => <span className="text-fg font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'zone',
        header: t('From'),
        cell: ({ row }) => row.original.zone ?? <span className="text-fg-subtle">—</span>,
      },
      {
        id: 'products',
        header: t('Products'),
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const used = counts.get(row.original.id) ?? 0
          return used === 0 ? (
            <span className="text-fg-subtle">{t('None')}</span>
          ) : (
            <span className="tabular-nums">{formatNumber(used)}</span>
          )
        },
      },
      {
        accessorKey: 'active',
        header: t('Status'),
        enableHiding: false,
        cell: ({ row }) => (
          <Badge tone={row.original.active ? 'success' : 'neutral'}>
            {row.original.active ? t('Active') : t('Hidden')}
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
                hidden: !can('settings.brands.edit'),
                onSelect: () => openFor(row.original),
              },
              {
                label: t('Delete'),
                icon: Trash2,
                destructive: true,
                hidden: !can('settings.brands.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, counts],
  )

  return (
    <>
      <PageHeader
        title={t('Brands')}
        description={
          tab === 'parts'
            ? t(
                'Who makes the parts you sell. A product points at one of these, so renaming a brand here renames it everywhere.',
              )
            : t(
                'The trucks your parts fit, and their models. Products and drivers’ trucks are picked from this list.',
              )
        }
        action={
          can('settings.brands.create') ? (
            tab === 'parts' ? (
              <Button variant="primary" onClick={() => openFor(null)}>
                <Plus />
                {t('Add brand')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => openMake(null)}>
                <Plus />
                {t('Add truck brand')}
              </Button>
            )
          ) : null
        }
      />

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as 'parts' | 'trucks')}
        items={[
          {
            value: 'parts',
            label: t('Part brands'),
            badge: brands.length,
            content: (
              <DataTable
                storageKey="settings-brands"
                columns={columns}
                data={brands}
                total={brands.length}
                isLoading={false}
                pagination={{ page: 1, pageSize: 50 }}
                onPaginationChange={() => {}}
                emptyState={
                  <EmptyState
                    icon={Tag}
                    title={t('No brands yet')}
                    description={t('Add the manufacturers whose parts you stock.')}
                  />
                }
              />
            ),
          },
          {
            value: 'trucks',
            label: t('Truck brands & models'),
            badge: vehicleMakes.length,
            content: <TruckBrandsPanel onEditMake={(make) => openMake(make)} />,
          },
        ]}
      />

      <Modal
        open={makeDialog !== null}
        onOpenChange={(next) => {
          if (!next) setMakeDialog(null)
        }}
        title={makeDialog?.make ? `Rename ${makeDialog.make.name}` : t('New truck brand')}
        description={
          makeDialog?.make
            ? t('Every product and truck that says this brand is updated to the new name.')
            : t('Add its models on its card afterwards.')
        }
        primary={{ label: makeDialog?.make ? 'Rename' : 'Add brand', onClick: saveMake }}
      >
        <Field label={t('Name')} required>
          {(p) => (
            <Input
              {...p}
              autoFocus
              placeholder={t('Shacman')}
              value={makeName}
              onChange={(event) => setMakeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveMake()
                }
              }}
            />
          )}
        </Field>
      </Modal>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : t('New brand')}
        primary={{ label: editing ? 'Save changes' : 'Add brand', onClick: save }}
      >
        <div className="space-y-3">
          <Field label={t('Name')} required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                placeholder={t('Bosch')}
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              />
            )}
          </Field>
          <Field label={t('From')} hint={t('Where the manufacturer is based')}>
            {(p) => (
              <Input
                {...p}
                placeholder={t('Germany')}
                value={draft.zone}
                onChange={(event) => setDraft((c) => ({ ...c, zone: event.target.value }))}
              />
            )}
          </Field>
          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="text-fg block text-sm font-medium">{t('Active')}</span>
              <span className="text-fg-subtle text-2xs">
                {t(
                  'A hidden brand stays on the products that already use it, but cannot be picked for new ones.',
                )}
              </span>
            </span>
            <Switch
              aria-label={t('Active')}
              checked={draft.active}
              onCheckedChange={(active) => setDraft((c) => ({ ...c, active }))}
            />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="Products already using it keep the name they were saved with."
        confirmLabel={t('Delete')}
        destructive
        onConfirm={() => {
          if (!deleting) return
          const result = remove(deleting.id)
          setDeleting(null)
          if (result.ok) toast.success(t('Brand deleted'))
          else toast.error(result.error)
        }}
      />
    </>
  )
}
