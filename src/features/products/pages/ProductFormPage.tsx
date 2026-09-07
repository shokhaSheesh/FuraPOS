import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { TagsInput } from '@/shared/ui/TagsInput'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import {
  useBrands,
  useCategories,
  useCreateProduct,
  useLocations,
  useProduct,
  useUpdateProduct,
} from '../api/products'
import { SegmentedControl } from '../components/SegmentedControl'
import { ProductStockSection } from '../components/ProductStockSection'
import { ProductOptionsEditor } from '../components/ProductOptionsEditor'
import { ProductVariationsTable } from '../components/ProductVariationsTable'
import {
  PART_SIDES,
  combinationName,
  isSideOption,
  optionCombinations,
  productFormSchema,
  reconcileVariations,
  usableOptions,
  type OptionValue,
  type ProductFormValues,
  type VariationMode,
} from '../model/product'

const UNITS = [
  { value: 'pcs', label: 'pcs' },
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'l' },
  { value: 'm', label: 'm' },
  { value: 'pack', label: 'pack' },
] as const

const MODES: { value: VariationMode; label: string }[] = [
  { value: 'single', label: 'One variation' },
  { value: 'multiple', label: 'Multiple variations' },
]

/** Maps a "Side" option's value onto the catalogue's typed `partSide` field. */
const sideValue = (optionValues: OptionValue[], optionId: string) =>
  PART_SIDES.find(
    (side) =>
      side.label.toLowerCase() ===
      optionValues
        .find((v) => v.optionId === optionId)
        ?.value.trim()
        .toLowerCase(),
  )?.value ?? null

/**
 * Every location gets a row whether or not it is currently picked, so that
 * toggling one off does not renumber the fields react-hook-form is registered
 * against. `locationIds` decides which are shown, and unpicked rows are
 * dropped on submit.
 */
const stockRows = (
  locations: readonly { id: string }[],
  existing: { locationId: string; quantity: number }[] = [],
) =>
  locations.map((location) => ({
    locationId: location.id,
    quantity: existing.find((row) => row.locationId === location.id)?.quantity ?? 0,
  }))

const emptyVariation = (
  locations: readonly { id: string }[],
  optionValues: OptionValue[] = [],
) => ({
  optionValues,
  sku: '',
  barcode: null,
  partSide: null,
  costPrice: 0,
  costCurrency: 'USD' as const,
  salePrice: 0,
  discountPrice: null,
  lowStockThreshold: null,
  shelfAddress: null,
  moq: null,
  status: 'active' as const,
  stockByLocation: stockRows(locations),
})

/**
 * Create and edit a product. One form for both, because they differ only in
 * where the values start.
 *
 * The form has one structural choice at the top: whether this product is sold
 * one way or several. Most parts are sold one way, and asking those for a
 * product name *and* a variation name gets the same string typed twice — so in
 * `single` mode the variation name is not asked for at all, and identity,
 * pricing and stock read as the product's own. This is the split Shopify makes
 * (a product carries its own price, SKU and inventory until options are added,
 * at which point those move onto each variant); we make it an explicit switch
 * rather than a side effect of adding an option, because switching back is
 * lossy and the user should see that before it happens.
 *
 * Sections run in the order a product is thought about: what it is, what it
 * fits, what is sold, how many there are, and where it shows up.
 */
export default function ProductFormPage() {
  const navigate = useNavigate()
  const { productId } = useParams()
  const editing = Boolean(productId && productId !== 'new')

  const { data: existing } = useProduct(editing ? productId! : '')
  const { data: categories } = useCategories()
  const { data: brands } = useBrands()
  const { data: locationData } = useLocations()
  const locations = locationData.items
  const create = useCreateProduct()
  const update = useUpdateProduct(productId ?? '')

  /** Asked before collapsing several variations down to one, which discards. */
  const [confirmCollapse, setConfirmCollapse] = useState(false)

  const defaults = useMemo<ProductFormValues>(
    () =>
      existing
        ? {
            name: existing.name,
            description: existing.description,
            categoryId: existing.categoryId,
            brandId: existing.brandId,
            manufacturer: existing.manufacturer,
            tags: existing.tags,
            unit: existing.unit,
            vehicleMake: existing.vehicleMake,
            vehicleModels: existing.vehicleModels,
            cargoWeightKg: existing.cargoWeightKg,
            cargoSize: existing.cargoSize,
            isShippable: existing.isShippable,
            showOnline: existing.showOnline,
            status: existing.status,
            variationMode: existing.options.length ? 'multiple' : 'single',
            options: existing.options.map((option) => ({ ...option, values: [...option.values] })),
            // A product is stocked wherever any of its variations already is.
            locationIds: locations
              .filter((location) =>
                existing.variations.some((v) =>
                  v.stockByLocation.some((row) => row.locationId === location.id),
                ),
              )
              .map((location) => location.id),
            variations: existing.variations.map((v) => ({
              id: v.id,
              optionValues: v.optionValues,
              sku: v.sku,
              barcode: v.barcode,
              partSide: v.partSide,
              costPrice: v.costPrice,
              costCurrency: v.costCurrency,
              salePrice: v.salePrice,
              discountPrice: v.discountPrice,
              lowStockThreshold: v.lowStockThreshold,
              shelfAddress: v.shelfAddress,
              moq: v.moq,
              status: v.status,
              stockByLocation: stockRows(locations, v.stockByLocation),
            })),
          }
        : {
            name: '',
            description: null,
            categoryId: '',
            brandId: null,
            manufacturer: null,
            tags: [],
            unit: 'pcs',
            vehicleMake: null,
            vehicleModels: [],
            cargoWeightKg: null,
            cargoSize: null,
            isShippable: true,
            showOnline: false,
            status: 'active',
            variationMode: 'single',
            options: [],
            locationIds: locations.length ? [locations[0]!.id] : [],
            variations: [emptyVariation(locations)],
          },
    [existing, locations],
  )

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const variations = form.watch('variations')
  const options = form.watch('options')
  const mode = form.watch('variationMode')
  const single = mode === 'single'
  const productName = form.watch('name')

  const live = usableOptions(options)
  const gridSummary = live.length
    ? `${optionCombinations(live).length} variations from ${live
        .map((option) => `${option.name} (${option.values.length})`)
        .join(' × ')}`
    : 'Each one has its own barcode, price and stock.'

  /**
   * Options are the source of truth for how many variations there are, so any
   * edit to them rebuilds the grid. Rows are matched by their combination, not
   * their position, so renaming a value does not move prices onto other rows;
   * combinations that no longer exist are dropped, and we say how many, because
   * a row vanishing silently is how a user loses work they typed.
   */
  const applyOptions = (next: ProductFormValues['options']) => {
    form.setValue('options', next, { shouldDirty: true })
    form.clearErrors('options')
    const { variations: rebuilt, dropped } = reconcileVariations(
      usableOptions(next),
      form.getValues('variations'),
      (values) => emptyVariation(locations, values),
      // A combination that did not exist a moment ago has no stock: it starts
      // from its sibling's pricing, never from its sibling's shelf.
      (row) => ({ ...row, stockByLocation: stockRows(locations) }),
    )
    form.setValue('variations', rebuilt, { shouldDirty: true })
    const lost = dropped.filter((v) => v.sku.trim() || v.salePrice > 0)
    if (lost.length) {
      toast.error(
        `${lost.length} variation${lost.length > 1 ? 's no longer match' : ' no longer matches'} the options and ${lost.length > 1 ? 'were' : 'was'} removed`,
      )
    }
  }

  const setMode = (next: VariationMode) => {
    if (next === mode) return
    if (next === 'single' && variations.length > 1) {
      setConfirmCollapse(true)
      return
    }
    form.setValue('variationMode', next, { shouldDirty: true })
    // Going to multiple with nothing to vary along leaves an empty grid, so
    // offer the axis this catalogue almost always means.
    if (next === 'multiple' && options.length === 0) {
      applyOptions([{ id: `opt-${Date.now()}`, name: 'Side', values: ['Left', 'Right'] }])
    }
  }

  const collapseToSingle = () => {
    form.setValue('options', [], { shouldDirty: true })
    form.setValue('variations', [{ ...form.getValues('variations.0'), optionValues: [] }], {
      shouldDirty: true,
    })
    form.setValue('variationMode', 'single', { shouldDirty: true })
    form.clearErrors(['variations', 'options'])
    setConfirmCollapse(false)
  }

  const onSubmit = form.handleSubmit(
    (values) => {
      // Duplicate SKUs inside one product would make two rows indistinguishable
      // in the catalogue, so they are caught here rather than at the store.
      const skus = values.variations.map((v) => v.sku.trim().toLowerCase())
      const duplicate = skus.findIndex((sku, i) => skus.indexOf(sku) !== i)
      if (duplicate > -1) {
        form.setError(`variations.${duplicate}.sku`, {
          message: 'Already used by another variation',
        })
        return
      }

      const singleMode = values.variationMode === 'single'
      const keptOptions = singleMode ? [] : usableOptions(values.options)
      const sideOption = keptOptions.find(isSideOption)
      const kept = singleMode ? values.variations.slice(0, 1) : values.variations

      const payload = {
        ...values,
        options: keptOptions,
        variations: kept.map((variation) => ({
          ...variation,
          optionValues: singleMode ? [] : variation.optionValues,
          // A "Side" option already answers this, so the typed field follows it
          // rather than being asked for a second time.
          partSide: sideOption
            ? (sideValue(variation.optionValues, sideOption.id) ?? variation.partSide)
            : variation.partSide,
          stockByLocation: variation.stockByLocation.filter((row) =>
            values.locationIds.includes(row.locationId),
          ),
        })),
      } as never

      if (editing) {
        update.mutate(payload, {
          onSuccess: () => {
            toast.success(`${values.name} saved`)
            navigate(paths.products.detail(productId!))
          },
        })
      } else {
        create.mutate(payload, {
          onSuccess: (product) => {
            toast.success(`${product.name} created`)
            navigate(paths.products.detail(product.id))
          },
        })
      }
    },
    () => {
      // A rejected save used to do nothing visible when the offending field was
      // below the fold or had no error slot. Never fail silently.
      toast.error('Check the highlighted fields')
    },
  )

  return (
    <form onSubmit={onSubmit}>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={editing ? paths.products.detail(productId!) : paths.products.list}>
          <ArrowLeft />
          {editing ? 'Back to product' : 'Products'}
        </Link>
      </Button>

      <PageHeader
        title={editing ? `Edit ${existing?.name ?? ''}` : 'New product'}
        description={
          single
            ? 'One barcode, one price, one line on a sale.'
            : 'A product describes the part. Its variations are what actually get sold.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(editing ? paths.products.detail(productId!) : paths.products.list)
              }
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editing ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-3">
        {/*
          Above every section, because the answer changes what they all mean:
          in `single` the Product section describes the thing being sold, in
          `multiple` it describes a family that is not sellable by itself.
        */}
        <Card>
          <CardBody className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-fg text-sm font-semibold">This product is sold as</p>
              <p className="text-fg-subtle text-2xs">
                {single
                  ? 'One sellable thing — it carries its own SKU, price and stock.'
                  : 'Several sellable things, generated from the options below. Each combination gets its own SKU, price and stock.'}
              </p>
            </div>
            <SegmentedControl
              aria-label="How many variations"
              value={mode}
              onChange={setMode}
              options={MODES}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Product name"
              required
              hint={single ? undefined : 'Shared by every variation below'}
              error={form.formState.errors.name?.message}
            >
              {(p) => <Input {...p} placeholder="Brake disc HD72" {...form.register('name')} />}
            </Field>
            <Field label="OEM number" hint="Or any reference text">
              {(p) => <Input {...p} {...form.register('description')} />}
            </Field>
            <Field label="Category" required error={form.formState.errors.categoryId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field: f }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={f.value || undefined}
                      onChange={f.onChange}
                      options={(categories?.items ?? []).map((c) => ({
                        value: c.id,
                        label: c.path,
                      }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Supplier brand" hint="Who we buy it from">
              {(p) => (
                <Controller
                  control={form.control}
                  name="brandId"
                  render={({ field: f }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={f.value ?? undefined}
                      onChange={f.onChange}
                      options={(brands?.items ?? []).map((b) => ({ value: b.id, label: b.name }))}
                      placeholder="None"
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Manufacturer" hint="Who made the part">
              {(p) => <Input {...p} {...form.register('manufacturer')} />}
            </Field>
            <Field label="Unit">
              {(p) => (
                <Controller
                  control={form.control}
                  name="unit"
                  render={({ field: f }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={f.value}
                      onChange={f.onChange}
                      options={[...UNITS]}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Tags" className="sm:col-span-2 lg:col-span-3">
              {(p) => (
                <Controller
                  control={form.control}
                  name="tags"
                  render={({ field: f }) => (
                    <TagsInput id={p.id} value={f.value} onChange={f.onChange} />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fitment</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Vehicle make">
              {(p) => <Input {...p} placeholder="DAF" {...form.register('vehicleMake')} />}
            </Field>
            <Field label="Vehicle models" hint="Enter to add each one">
              {(p) => (
                <Controller
                  control={form.control}
                  name="vehicleModels"
                  render={({ field: f }) => (
                    <TagsInput
                      id={p.id}
                      value={f.value}
                      onChange={f.onChange}
                      placeholder="XF 105"
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Cargo weight (kg)">
              {(p) => (
                <Controller
                  control={form.control}
                  name="cargoWeightKg"
                  render={({ field: f }) => (
                    <NumberField
                      {...p}
                      step="any"
                      className="text-left"
                      value={f.value}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Cargo size">
              {(p) => <Input {...p} placeholder="120*60*30" {...form.register('cargoSize')} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle>{single ? 'Identity & pricing' : 'Variations'}</CardTitle>
              <p className="text-fg-subtle text-2xs">
                {single
                  ? 'This product is one sellable thing, so these belong to it directly.'
                  : gridSummary}
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {single ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="SKU"
                  required
                  error={form.formState.errors.variations?.[0]?.sku?.message}
                >
                  {(p) => <Input {...p} {...form.register('variations.0.sku')} />}
                </Field>
                <Field label="Barcode">
                  {(p) => <Input {...p} {...form.register('variations.0.barcode')} />}
                </Field>
                <Field label="Side">
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="variations.0.partSide"
                      render={({ field: f }) => (
                        <Select
                          {...p}
                          className="w-full"
                          value={f.value ?? undefined}
                          onChange={f.onChange}
                          options={PART_SIDES}
                          placeholder="Not sided"
                        />
                      )}
                    />
                  )}
                </Field>
                <Field
                  label="Cost"
                  hint="What the supplier invoices"
                  error={form.formState.errors.variations?.[0]?.costPrice?.message}
                >
                  {(p) => (
                    <div className="flex gap-1.5">
                      <Controller
                        control={form.control}
                        name="variations.0.costPrice"
                        render={({ field: f }) => (
                          <NumberField
                            {...p}
                            nullable={false}
                            step="any"
                            value={f.value}
                            onChange={(v) => f.onChange(v ?? 0)}
                            onBlur={f.onBlur}
                          />
                        )}
                      />
                      <Controller
                        control={form.control}
                        name="variations.0.costCurrency"
                        render={({ field: f }) => (
                          <Select
                            value={f.value}
                            onChange={f.onChange}
                            options={[
                              { value: 'USD', label: 'USD' },
                              { value: 'UZS', label: 'UZS' },
                            ]}
                            aria-label="Cost currency"
                            className="w-24"
                          />
                        )}
                      />
                    </div>
                  )}
                </Field>
                <Field
                  label="Sale price"
                  required
                  error={form.formState.errors.variations?.[0]?.salePrice?.message}
                >
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="variations.0.salePrice"
                      render={({ field: f }) => (
                        <NumberField
                          {...p}
                          nullable={false}
                          value={f.value}
                          onChange={(v) => f.onChange(v ?? 0)}
                          onBlur={f.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
                <Field label="Discounted price" hint="Leave empty for none">
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="variations.0.discountPrice"
                      render={({ field: f }) => (
                        <NumberField
                          {...p}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
                <Field label="Reorder point" hint="Warn below this">
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="variations.0.lowStockThreshold"
                      render={({ field: f }) => (
                        <NumberField
                          {...p}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
                <Field label="Shelf">
                  {(p) => (
                    <Input
                      {...p}
                      placeholder="A-12-3"
                      {...form.register('variations.0.shelfAddress')}
                    />
                  )}
                </Field>
                <Field
                  label="MOQ"
                  hint="Supplier minimum"
                  error={form.formState.errors.variations?.[0]?.moq?.message}
                >
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="variations.0.moq"
                      render={({ field: f }) => (
                        <NumberField
                          {...p}
                          min={1}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
              </div>
            ) : (
              <>
                <ProductOptionsEditor form={form} options={options} onChange={applyOptions} />
                {variations.length ? (
                  <ProductVariationsTable form={form} productName={productName.trim()} />
                ) : (
                  <p className="text-fg-subtle text-sm">
                    Name an option and give it values — the variations appear here.
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>
        <ProductStockSection form={form} locations={locations} editing={editing} />

        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardBody className="grid items-end gap-3 sm:grid-cols-3">
            <ToggleRow
              control={form.control}
              name="isShippable"
              label="Shippable"
              hint="Can be sent by courier"
            />
            <ToggleRow
              control={form.control}
              name="showOnline"
              label="Show online"
              hint="Visible in the storefront"
            />
            <Field label="Status">
              {(p) => (
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field: f }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={f.value}
                      onChange={f.onChange}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'archived', label: 'Archived' },
                      ]}
                    />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCollapse}
        onOpenChange={setConfirmCollapse}
        title="Sell this as one thing?"
        confirmLabel="Keep the first"
        body={`This drops the ${options.map((o) => o.name.trim() || 'unnamed').join(' and ')} option${
          options.length > 1 ? 's' : ''
        } and every variation but “${
          combinationName(variations[0]?.optionValues ?? []) || variations[0]?.sku || 'the first'
        }”, along with their stock.`}
        onConfirm={collapseToSingle}
      />
    </form>
  )
}

function ToggleRow({
  control,
  name,
  label,
  hint,
}: {
  control: Control<ProductFormValues>
  name: 'isShippable' | 'showOnline'
  label: string
  hint: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        // Boxed, because side by side in a grid a bare label and a far-right
        // switch read as belonging to different rows.
        <div className="border-border rounded-control flex items-center justify-between gap-3 border px-3 py-2">
          <div>
            <p className="text-fg text-sm">{label}</p>
            <p className="text-fg-subtle text-2xs">{hint}</p>
          </div>
          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} />
        </div>
      )}
    />
  )
}
