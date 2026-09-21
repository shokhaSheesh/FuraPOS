import { useMemo } from 'react'
import { Select } from '@/shared/ui/Select'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import {
  countByCategory,
  groupByProduct,
  type CatalogueRow,
} from '@/shared/components/catalogue/browse'
import { fitsTruck, inCategory } from '../model/browseFilter'
import type { TillBrowse } from './TillCatalogueSidebar'

/** "No filter" in a select, which cannot hold null. */
const ALL = '__all__'

/**
 * The other way into the shelf, beside the view switcher (client request):
 * browsing «По товарам», a make and a model; browsing «По автомобилям», a
 * category. Only what this shop stocks is offered, within the sidebar's choice.
 */
export function TillFilters({
  rows,
  value,
  onChange,
}: {
  rows: CatalogueRow[]
  value: TillBrowse
  onChange: (next: TillBrowse) => void
}) {
  const categories = useDataStore((s) => s.categorySettings)
  const vehicleMakes = useDataStore((s) => s.vehicleMakes)
  const groups = useMemo(() => groupByProduct(rows), [rows])

  const makes = useMemo(() => {
    const shelf = inCategory(groups, value, categories)
    return vehicleMakes
      .filter((make) => shelf.some((g) => g.vehicleMakes.includes(make.name)))
      .map((make) => ({
        name: make.name,
        models: make.models
          .map((model) => model.name)
          .filter((model) =>
            shelf.some(
              (g) => g.vehicleMakes.includes(make.name) && g.vehicleModels.includes(model),
            ),
          ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [groups, value, categories, vehicleMakes])

  const categoryOptions = useMemo(() => {
    const counts = countByCategory(fitsTruck(groups, value), categories)
    const pathOf = (id: string | null): string[] => {
      const category = categories.find((entry) => entry.id === id)
      return category ? [...pathOf(category.parentId), category.name] : []
    }
    return categories
      .filter((category) => (counts.get(category.id) ?? 0) > 0)
      .map((category) => ({ value: category.id, label: pathOf(category.id).join(' › ') }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [groups, value, categories])

  if (value.mode === 'trucks') {
    return (
      <Select
        className="w-48"
        aria-label={t('Category')}
        value={value.categoryId ?? ALL}
        onChange={(id) => onChange({ ...value, categoryId: id === ALL ? null : id })}
        options={[{ value: ALL, label: t('All categories') }, ...categoryOptions]}
      />
    )
  }

  const models = makes.find((make) => make.name === value.make)?.models ?? []
  return (
    <>
      <Select
        className="w-36"
        aria-label={t('Truck make')}
        value={value.make ?? ALL}
        onChange={(make) => onChange({ ...value, make: make === ALL ? null : make, model: null })}
        options={[
          { value: ALL, label: t('All makes') },
          ...makes.map((make) => ({ value: make.name, label: make.name })),
        ]}
      />
      <Select
        className="w-40"
        aria-label={t('Model')}
        value={value.model ?? ALL}
        disabled={!value.make}
        onChange={(model) => onChange({ ...value, model: model === ALL ? null : model })}
        options={[
          { value: ALL, label: value.make ? t('All models') : t('Pick a make first') },
          ...models.map((model) => ({ value: model, label: model })),
        ]}
      />
    </>
  )
}
