import { useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Trash2, Truck, X } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { useSession } from '@/app/providers/SessionProvider'
import { useDataStore } from '@/data/store'
import { vehicleUsage, type VehicleMake, type VehicleModel } from '../model/settings'

/**
 * Truck brands and their models.
 *
 * One card per brand with its models laid out as chips, because the job here
 * is mostly *adding a run of models to one brand* — DAF gets XF 95, XF 105,
 * CF 85 in a row — and a chip list with a box underneath lets that happen by
 * typing and pressing Enter, with no dialog per model.
 *
 * Every chip and every card says how much leans on it. That is what makes a
 * rename safe to do (it is written through to all of them) and a delete
 * honest (it is refused while anything still uses it, and says what).
 */
export function TruckBrandsPanel({ onEditMake }: { onEditMake: (make: VehicleMake) => void }) {
  const { can } = useSession()
  const makes = useDataStore((s) => s.vehicleMakes)
  const products = useDataStore((s) => s.products)
  const drivers = useDataStore((s) => s.drivers)
  const deleteMake = useDataStore((s) => s.deleteVehicleMake)

  const trucks = useMemo(
    () => drivers.flatMap((d) => [...d.ownTrucks, ...(d.autoparkTruck ? [d.autoparkTruck] : [])]),
    [drivers],
  )
  const sorted = useMemo(() => [...makes].sort((a, b) => a.name.localeCompare(b.name)), [makes])
  const modelCount = makes.reduce((sum, make) => sum + make.models.length, 0)

  if (makes.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No truck brands yet"
        description="Add the brands you sell parts for — DAF, MAN, Volvo — and then their models."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-fg-muted text-sm">
        {formatNumber(makes.length)} brands · {formatNumber(modelCount)} models. Products say which
        of these they fit, and drivers’ trucks are picked from the same list — renaming here updates
        both.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {sorted.map((make) => {
          const usage = vehicleUsage(make.name, null, products, trucks)
          return (
            <Card key={make.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-fg truncate text-base font-semibold">{make.name}</p>
                  <p className="text-fg-subtle text-2xs">
                    {formatNumber(make.models.length)}{' '}
                    {make.models.length === 1 ? 'model' : 'models'} · {formatNumber(usage.products)}{' '}
                    {usage.products === 1 ? 'product fits' : 'products fit'} ·{' '}
                    {formatNumber(usage.trucks)} {usage.trucks === 1 ? 'truck' : 'trucks'}
                  </p>
                </div>
                <RowActions
                  actions={[
                    {
                      label: 'Rename',
                      icon: Pencil,
                      hidden: !can('settings.brands.edit'),
                      onSelect: () => onEditMake(make),
                    },
                    {
                      label: 'Delete',
                      icon: Trash2,
                      destructive: true,
                      hidden: !can('settings.brands.delete'),
                      onSelect: () => {
                        const result = deleteMake(make.id)
                        if (result.ok) toast.success(`${make.name} deleted`)
                        else toast.error(result.error)
                      },
                    },
                  ]}
                />
              </div>

              <ModelChips make={make} products={products} trucks={trucks} />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function ModelChips({
  make,
  products,
  trucks,
}: {
  make: VehicleMake
  products: { vehicleMake: string | null; vehicleModels: string[] }[]
  trucks: { make: string | null; model: string | null }[]
}) {
  const { can } = useSession()
  const addModel = useDataStore((s) => s.addVehicleModel)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const canEdit = can('settings.brands.edit')

  const add = () => {
    if (!draft.trim()) return
    const result = addModel(make.id, draft)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setDraft('')
    // Straight back into the box: models usually arrive several at a time.
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      {make.models.length === 0 ? (
        <p className="text-fg-subtle text-sm">No models yet — add the first one below.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {[...make.models]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            .map((model) => (
              <Chip
                key={model.id}
                make={make}
                model={model}
                used={vehicleUsage(make.name, model.name, products, trucks)}
                canEdit={canEdit}
              />
            ))}
        </ul>
      )}

      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Add a ${make.name} model, then Enter`}
            aria-label={`Add a ${make.name} model`}
            className="h-8 flex-1 text-sm"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim()}>
            <Plus />
            Add
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function Chip({
  make,
  model,
  used,
  canEdit,
}: {
  make: VehicleMake
  model: VehicleModel
  used: { products: number; trucks: number }
  canEdit: boolean
}) {
  const renameModel = useDataStore((s) => s.renameVehicleModel)
  const deleteModel = useDataStore((s) => s.deleteVehicleModel)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(model.name)
  const total = used.products + used.trucks

  const save = () => {
    setEditing(false)
    if (name.trim() === model.name) return
    const result = renameModel(make.id, model.id, name)
    if (result.ok) {
      toast.success(
        total > 0 ? `Renamed — ${total} ${total === 1 ? 'place' : 'places'} updated` : 'Renamed',
      )
    } else {
      toast.error(result.error)
      setName(model.name)
    }
  }

  if (editing) {
    return (
      <li>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
            if (event.key === 'Escape') {
              setName(model.name)
              setEditing(false)
            }
          }}
          aria-label={`Rename ${make.name} ${model.name}`}
          className="h-7 w-32 text-sm"
        />
      </li>
    )
  }

  return (
    <li
      className={cn(
        'border-border bg-surface-muted text-fg flex items-center rounded-full border text-sm',
      )}
    >
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setEditing(true)}
        title={canEdit ? 'Click to rename' : undefined}
        className="flex items-center gap-1.5 rounded-l-full py-1 pr-1 pl-2.5 hover:underline disabled:hover:no-underline"
      >
        {model.name}
        {/* How much leans on it, so a delete that gets refused is not a surprise. */}
        {total > 0 ? (
          <span className="text-fg-subtle text-2xs tabular-nums">{formatNumber(total)}</span>
        ) : null}
      </button>
      {canEdit ? (
        <button
          type="button"
          aria-label={`Remove ${make.name} ${model.name}`}
          onClick={() => {
            const result = deleteModel(make.id, model.id)
            if (result.ok) toast.success(`${model.name} removed`)
            else toast.error(result.error)
          }}
          className="text-fg-subtle hover:text-danger rounded-r-full py-1 pr-2 pl-0.5"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </li>
  )
}
