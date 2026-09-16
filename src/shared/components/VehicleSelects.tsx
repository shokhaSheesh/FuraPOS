import { useMemo } from 'react'
import { Select } from '@/shared/ui/Select'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { useDataStore } from '@/data/store'

/*
 * Truck brand and model pickers, fed by Settings → Brands → Truck brands.
 *
 * Products and trucks store the names, so these pick names too. A value that is
 * not on the list — typed before the list existed — is still offered, because
 * Radix shows an unmatched value as a blank control, and a field that silently
 * empties itself looks like lost data.
 */

const NONE = '__none__'

const withCurrent = (names: string[], current: string | null | undefined) =>
  current && !names.includes(current) ? [...names, current] : names

export function VehicleMakeSelect({
  value,
  onChange,
  disabled,
  id,
  className = 'w-full',
  'aria-label': ariaLabel,
}: {
  value: string | null
  onChange: (make: string | null) => void
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}) {
  const makes = useDataStore((s) => s.vehicleMakes)
  const names = useMemo(
    () =>
      withCurrent(
        makes.map((m) => m.name).sort((a, b) => a.localeCompare(b)),
        value,
      ),
    [makes, value],
  )
  return (
    <div id={id}>
      <Select
        aria-label={ariaLabel ?? 'Truck brand'}
        className={className}
        disabled={disabled}
        value={value || NONE}
        onChange={(next) => onChange(next === NONE ? null : next)}
        options={[
          { value: NONE, label: 'No brand' },
          ...names.map((n) => ({ value: n, label: n })),
        ]}
      />
    </div>
  )
}

/** The models of one brand; empty and disabled until a brand is picked. */
export function useModelsOf(make: string | null) {
  const makes = useDataStore((s) => s.vehicleMakes)
  return useMemo(
    () =>
      (makes.find((m) => m.name === make)?.models ?? [])
        .map((m) => m.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [makes, make],
  )
}

/**
 * The models of every brand picked, labelled by brand so "XF 105" from DAF and
 * a same-named model of another make are still told apart.
 */
export function useModelsOfMany(picked: string[]) {
  const makes = useDataStore((s) => s.vehicleMakes)
  return useMemo(
    () =>
      makes
        .filter((make) => picked.includes(make.name))
        .flatMap((make) => make.models.map((model) => ({ make: make.name, model: model.name })))
        .sort((a, b) => a.model.localeCompare(b.model, undefined, { numeric: true })),
    [makes, picked],
  )
}

/** Truck brands, several at a time — a part rarely fits only one lorry. */
export function VehicleMakesMultiSelect({
  value,
  onChange,
  id,
}: {
  value: string[]
  onChange: (makes: string[]) => void
  id?: string
}) {
  const makes = useDataStore((s) => s.vehicleMakes)
  const options = [...new Set([...makes.map((m) => m.name), ...value])]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }))
  return (
    <div id={id}>
      <MultiSelect
        aria-label="Truck brands"
        className="w-full"
        placeholder="Any brand"
        searchPlaceholder="Search truck brands…"
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  )
}

export function VehicleModelSelect({
  make,
  value,
  onChange,
  disabled,
  className = 'w-full',
  'aria-label': ariaLabel,
}: {
  make: string | null
  value: string | null
  onChange: (model: string | null) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const models = withCurrent(useModelsOf(make), value)
  return (
    <Select
      aria-label={ariaLabel ?? 'Truck model'}
      className={className}
      disabled={disabled || !make}
      placeholder={make ? 'Pick a model' : 'Pick the brand first'}
      value={value || NONE}
      onChange={(next) => onChange(next === NONE ? null : next)}
      options={[
        { value: NONE, label: make ? 'No model' : 'Pick the brand first' },
        ...models.map((n) => ({ value: n, label: n })),
      ]}
    />
  )
}

/** Every model of every brand picked, so one control covers all of them. */
export function VehicleModelsMultiSelect({
  makes,
  value,
  onChange,
}: {
  makes: string[]
  value: string[]
  onChange: (models: string[]) => void
}) {
  const models = useModelsOfMany(makes)
  const known = new Map(models.map((entry) => [entry.model, entry.make]))
  const options = [...new Set([...models.map((entry) => entry.model), ...value])].map((name) => ({
    value: name,
    label: name,
    meta: known.get(name),
  }))
  return (
    <MultiSelect
      aria-label="Models it fits"
      className="w-full"
      disabled={makes.length === 0}
      placeholder={makes.length ? 'All models, or pick some' : 'Pick a brand first'}
      searchPlaceholder="Search models…"
      value={value}
      onChange={onChange}
      options={options}
    />
  )
}
