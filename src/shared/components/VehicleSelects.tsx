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

export function VehicleModelsMultiSelect({
  make,
  value,
  onChange,
}: {
  make: string | null
  value: string[]
  onChange: (models: string[]) => void
}) {
  const models = useModelsOf(make)
  const options = [...new Set([...models, ...value])].map((n) => ({ value: n, label: n }))
  return (
    <MultiSelect
      aria-label="Models it fits"
      className="w-full"
      disabled={!make}
      placeholder={make ? 'All models, or pick some' : 'Pick the brand first'}
      searchPlaceholder={`Search ${make ?? ''} models…`}
      value={value}
      onChange={onChange}
      options={options}
    />
  )
}
