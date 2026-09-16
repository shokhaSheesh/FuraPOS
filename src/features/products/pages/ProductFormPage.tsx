import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import {
  VehicleMakesMultiSelect,
  VehicleModelsMultiSelect,
} from '@/shared/components/VehicleSelects'
import { PageHeader } from '@/shared/components/PageHeader'
import { Steps } from '@/shared/components/Steps'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Input } from '@/shared/ui/Input'
import { ImageField } from '@/shared/components/ImageField'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useDataStore } from '@/data/store'
import {
  useBrands,
  useCategories,
  useCreateProduct,
  useLocations,
  useProduct,
  useUpdateProduct,
} from '../api/products'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { ProductStockSection } from '../components/ProductStockSection'
import { ProductOptionsEditor } from '../components/ProductOptionsEditor'
import { ProductVariationsTable } from '../components/ProductVariationsTable'
import {
  combinationName,
  isSideOption,
  productFormSchema,
  reconcileVariations,
  usableOptions,
  type OptionValue,
  type ProductFormValues,
  type VariationMode,
} from '../model/product'

const CURRENCIES: { value: 'USD' | 'UZS'; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

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

/** A "Side" option answers the Part field directly, so it is never asked twice. */
const sideValue = (optionValues: OptionValue[], optionId: string) =>
  optionValues.find((v) => v.optionId === optionId)?.value.trim() || null

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
  enabled: true,
  name: '',
  sku: '',
  barcode: null,
  partSide: null,
  oem: null,
  cargoWeightKg: null,
  cargoSize: null,
  costPrice: 0,
  costCurrency: 'USD' as const,
  salePrice: 0,
  saleCurrency: 'UZS' as const,
  wholesalePrice: null,
  wholesaleCurrency: 'UZS' as const,
  discountPrice: null,
  lowStockThreshold: null,
  shelfAddress: null,
  mobileSku: null,
  mobileName: null,
  status: 'active' as const,
  imageUrl: null,
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
  return (
    <ProductForm
      productId={productId}
      onSaved={(id) => navigate(paths.products.detail(id))}
      onCancel={() => navigate(editing ? paths.products.detail(productId!) : paths.products.list)}
    />
  )
}

/**
 * The product form itself, so it can be opened from somewhere other than its
 * own page — the order screen's "New item" opens exactly this, full screen,
 * rather than a cut-down copy that would drift from it.
 */
export function ProductForm({
  productId,
  onSaved,
  onCancel,
  embedded = false,
}: {
  productId?: string
  /** Called with the product's id once it is created or saved. */
  onSaved: (productId: string) => void
  onCancel: () => void
  /** Opened over another screen: no "back to products" link. */
  embedded?: boolean
}) {
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

  /*
    Three steps, as on New transfer and New order: what the part is, then what
    is actually sold and for how much, then how many there are. A product form
    that asks thirty questions at once is where people give up; this also puts
    the answers in the order they depend on each other — the variation grid is
    built from the options chosen in step one's "sold as" switch.
  */
  const [step, setStep] = useState<1 | 2 | 3>(1)

  /** Which models belong to which truck brand, for keeping the two in step. */
  const vehicleMakeSettings = useDataStore((s) => s.vehicleMakes)
  const modelsByMake = useMemo(
    () =>
      vehicleMakeSettings.map((make) => ({
        make: make.name,
        models: make.models.map((model) => model.name),
      })),
    [vehicleMakeSettings],
  )

  const defaults = useMemo<ProductFormValues>(
    () =>
      existing
        ? {
            name: existing.name,
            description: existing.description,
            categoryId: existing.categoryId,
            brandId: existing.brandId,
            manufacturer: existing.manufacturer,
            unit: existing.unit,
            vehicleMakes: existing.vehicleMakes,
            vehicleModels: existing.vehicleModels,
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
            /*
              Every combination is listed, but only the ones that were saved
              are ticked. A combination the business does not make shows as an
              unsold row rather than silently missing, so it can be switched on
              later without rebuilding the options.
            */
            variations: reconcileVariations(
              existing.options,
              existing.variations.map((v) => ({
                id: v.id as string | undefined,
                // "Standard" is the placeholder the catalogue hides, not a name.
                name: v.name === 'Standard' ? '' : v.name,
                optionValues: v.optionValues,
                enabled: true,
                sku: v.sku,
                barcode: v.barcode,
                partSide: v.partSide,
                oem: v.oem,
                cargoWeightKg: v.cargoWeightKg,
                cargoSize: v.cargoSize,
                costPrice: v.costPrice,
                costCurrency: v.costCurrency,
                salePrice: v.salePrice,
                saleCurrency: v.saleCurrency,
                wholesalePrice: v.wholesalePrice,
                wholesaleCurrency: v.wholesaleCurrency,
                discountPrice: v.discountPrice,
                lowStockThreshold: v.lowStockThreshold,
                shelfAddress: v.shelfAddress,
                status: v.status,
                imageUrl: v.imageUrl,
                stockByLocation: stockRows(locations, v.stockByLocation),
              })),
              (values) => ({ ...emptyVariation(locations, values), id: undefined, enabled: false }),
              (row) => ({ ...row, enabled: false, stockByLocation: stockRows(locations) }),
            ).variations,
          }
        : {
            name: '',
            description: null,
            categoryId: '',
            brandId: null,
            manufacturer: null,
            unit: 'pcs',
            vehicleMakes: [],
            vehicleModels: [],
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
  const soldCount = variations.filter((variation) => variation.enabled).length
  const gridSummary = live.length
    ? `${live.map((option) => `${option.name} (${option.values.length})`).join(' × ')} makes ${
        variations.length
      } combinations${
        soldCount === variations.length
          ? ', all sold'
          : ` — ${soldCount} sold. Untick the ones you do not make.`
      }`
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

  /** A step is left only once its own fields are valid, so errors stay near their field. */
  const goTo = async (next: 1 | 2 | 3) => {
    if (next <= step) return setStep(next)
    if (step === 1 && !(await form.trigger(['name', 'categoryId']))) return
    if (step === 2 && !(await form.trigger(['variations', 'options']))) return
    setStep(next)
  }

  const onSubmit = form.handleSubmit(
    (values) => {
      // Duplicate SKUs inside one product would make two rows indistinguishable
      // in the catalogue, so they are caught here rather than at the store.
      // Only among sold combinations: an unsold row has no SKU to clash.
      const skus = values.variations.map((v) => (v.enabled ? v.sku.trim().toLowerCase() : null))
      const duplicate = skus.findIndex((sku, i) => sku !== null && skus.indexOf(sku) !== i)
      if (duplicate > -1) {
        form.setError(`variations.${duplicate}.sku`, {
          message: 'Already used by another variation',
        })
        return
      }

      const singleMode = values.variationMode === 'single'
      const keptOptions = singleMode ? [] : usableOptions(values.options)
      const sideOption = keptOptions.find(isSideOption)
      // An unticked combination is not a variation: it is never created.
      const kept = singleMode
        ? values.variations.slice(0, 1)
        : values.variations.filter((variation) => variation.enabled)

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
            onSaved(productId!)
          },
        })
      } else {
        create.mutate(payload, {
          onSuccess: (product) => {
            toast.success(`${product.name} created`)
            onSaved(product.id)
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
      {embedded ? null : (
        <Button variant="link" size="sm" className="h-auto px-0" asChild>
          <Link to={editing ? paths.products.detail(productId!) : paths.products.list}>
            <ArrowLeft />
            {editing ? 'Back to product' : 'Products'}
          </Link>
        </Button>
      )}

      <PageHeader
        /*
          Once the name is typed it stays at the top of every step, so the later
          ones — a grid of variations, a table of quantities — never leave you
          wondering which product you are filling in. The reference does the same.
        */
        title={productName.trim() || (editing ? `Edit ${existing?.name ?? ''}` : 'New product')}
        description={
          step === 1
            ? single
              ? 'One barcode, one price, one line on a sale.'
              : 'A product describes the part. Its variations are what actually get sold.'
            : editing
              ? 'Editing'
              : 'New product'
        }
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            {step === 3 ? (
              <Button key="save" type="submit" variant="primary">
                {editing ? 'Save changes' : 'Create product'}
              </Button>
            ) : (
              <Button
                // Keyed apart from the submit button it becomes on the last
                // step: React would otherwise reuse the same DOM node, and the
                // browser would run the default action of a node that has just
                // turned into type="submit" — saving the product on Continue.
                key="continue"
                type="button"
                variant="primary"
                onClick={() => goTo((step + 1) as 2 | 3)}
              >
                Continue
              </Button>
            )}
          </div>
        }
        below={
          <Steps
            steps={['Product', single ? 'Variation' : 'Variations', 'Stock']}
            current={step}
            onSelect={(n) => goTo(n as 1 | 2 | 3)}
          />
        }
      />

      <div className="mt-4 space-y-3">
        {/*
          The three steps and what sits in each follow the reference product:
          what the thing *is* and where it belongs; then what is actually sold
          and what describes it; then money and how many there are. Within a
          step the main column carries the answers and the narrow one beside it
          the choices that classify them.
        */}
        {step === 1 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Product</CardTitle>
                </CardHeader>
                <CardBody className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Product name"
                    required
                    hint={single ? undefined : 'Shared by every variation'}
                    error={form.formState.errors.name?.message}
                  >
                    {(p) => (
                      <Input {...p} placeholder="Brake disc HD72" {...form.register('name')} />
                    )}
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
                  <Field
                    label="Description"
                    hint="Shown to customers online — headings, lists and links are kept"
                    className="sm:col-span-2"
                  >
                    {(p) => (
                      <Controller
                        control={form.control}
                        name="description"
                        render={({ field: f }) => (
                          <RichTextEditor id={p.id} value={f.value} onChange={f.onChange} />
                        )}
                      />
                    )}
                  </Field>
                  <Field label="Media" className="sm:col-span-2">
                    {() =>
                      single ? (
                        <Controller
                          control={form.control}
                          name="variations.0.imageUrl"
                          render={({ field: f }) => (
                            <ImageField value={f.value} onChange={f.onChange} size="lg" />
                          )}
                        />
                      ) : (
                        <p className="text-fg-subtle text-sm">
                          Each variation has its own picture — they are on the next step, beside the
                          variation they belong to.
                        </p>
                      )
                    }
                  </Field>
                </CardBody>
              </Card>

              <div className="space-y-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Where it belongs</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <Field label="Supplier" hint="Who we buy it from">
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
                              options={(brands?.items ?? []).map((b) => ({
                                value: b.id,
                                label: b.name,
                              }))}
                              placeholder="None"
                            />
                          )}
                        />
                      )}
                    </Field>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Category</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <Field
                      label="Category"
                      required
                      error={form.formState.errors.categoryId?.message}
                    >
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
                  </CardBody>
                </Card>

                <ProductStockSection
                  form={form}
                  locations={locations}
                  editing={editing}
                  part="locations"
                />
              </div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {/* Asked here, as the reference asks it: it is the first decision
                of this step and it decides what the rest of the step shows. */}
            <Card>
              <CardBody className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-fg text-sm font-semibold">This product is sold as</p>
                  <p className="text-fg-subtle text-2xs">
                    {single
                      ? 'One sellable thing — it carries its own SKU, price and stock.'
                      : 'Several sellable things, generated from the options below.'}
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
              <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div>
                  <CardTitle>{single ? 'Variation' : 'Variations'}</CardTitle>
                  <p className="text-fg-subtle text-2xs">
                    {single
                      ? 'This product is one sellable thing, so these belong to it directly.'
                      : gridSummary}
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                {single ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                      label="Variation name"
                      hint="What this one is called — leave empty if it has no name"
                    >
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="Standard"
                          {...form.register('variations.0.name')}
                        />
                      )}
                    </Field>
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

            {/* OX's «Характеристика»: what the part is, beyond its identity. */}
            <Card>
              <CardHeader>
                <CardTitle>Attributes</CardTitle>
              </CardHeader>
              <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {single ? (
                  <Field label="OEM">
                    {(p) => (
                      <Input {...p} placeholder="1234567" {...form.register('variations.0.oem')} />
                    )}
                  </Field>
                ) : null}
                <Field label="Product brand" hint="Who made the part">
                  {(p) => <Input {...p} {...form.register('manufacturer')} />}
                </Field>
                {/* Picked from Settings → Brands → Truck brands, so one model is
                    never spelled three ways across the catalogue. */}
                <Field label="Truck brands" hint="The lorries this part fits">
                  {(p) => (
                    <Controller
                      control={form.control}
                      name="vehicleMakes"
                      render={({ field: f }) => (
                        <VehicleMakesMultiSelect
                          id={p.id}
                          value={f.value}
                          onChange={(makes) => {
                            // A model belongs to one brand: dropping a brand drops
                            // the models that came with it, and keeps the rest.
                            const kept = new Set(
                              makes.flatMap(
                                (make) =>
                                  modelsByMake.find((entry) => entry.make === make)?.models ?? [],
                              ),
                            )
                            form.setValue(
                              'vehicleModels',
                              form.getValues('vehicleModels').filter((model) => kept.has(model)),
                            )
                            f.onChange(makes)
                          }}
                        />
                      )}
                    />
                  )}
                </Field>
                <Field label="Models it fits" hint="Leave empty if it fits every model">
                  {() => (
                    <Controller
                      control={form.control}
                      name="vehicleModels"
                      render={({ field: f }) => (
                        <VehicleModelsMultiSelect
                          makes={form.watch('vehicleMakes')}
                          value={f.value}
                          onChange={f.onChange}
                        />
                      )}
                    />
                  )}
                </Field>
                {single ? (
                  <>
                    <Field label="Part" hint="Which part of the vehicle it fits">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="Left"
                          {...form.register('variations.0.partSide')}
                        />
                      )}
                    </Field>
                    <Field label="Cargo weight (kg)">
                      {(p) => (
                        <Controller
                          control={form.control}
                          name="variations.0.cargoWeightKg"
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
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="120*60*30"
                          {...form.register('variations.0.cargoSize')}
                        />
                      )}
                    </Field>
                  </>
                ) : (
                  <p className="text-fg-subtle text-sm sm:col-span-2 lg:col-span-3">
                    OEM, part, cargo weight and cargo size differ between variations, so they are
                    asked for in the table above.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              {single ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Amount</CardTitle>
                  </CardHeader>
                  <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                      label="Supplier price"
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
                                options={CURRENCIES}
                                aria-label="Supplier price currency"
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
                        <div className="flex gap-1.5">
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
                          <Controller
                            control={form.control}
                            name="variations.0.saleCurrency"
                            render={({ field: f }) => (
                              <Select
                                value={f.value}
                                onChange={f.onChange}
                                options={CURRENCIES}
                                aria-label="Sale price currency"
                                className="w-24"
                              />
                            )}
                          />
                        </div>
                      )}
                    </Field>
                    <Field label="Wholesale price" hint="What a trade customer pays">
                      {(p) => (
                        <div className="flex gap-1.5">
                          <Controller
                            control={form.control}
                            name="variations.0.wholesalePrice"
                            render={({ field: f }) => (
                              <NumberField
                                {...p}
                                value={f.value}
                                onChange={f.onChange}
                                onBlur={f.onBlur}
                              />
                            )}
                          />
                          <Controller
                            control={form.control}
                            name="variations.0.wholesaleCurrency"
                            render={({ field: f }) => (
                              <Select
                                value={f.value}
                                onChange={f.onChange}
                                options={CURRENCIES}
                                aria-label="Wholesale price currency"
                                className="w-24"
                              />
                            )}
                          />
                        </div>
                      )}
                    </Field>
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody className="p-4">
                    <p className="text-fg-subtle text-sm">
                      Each variation is priced on the previous step, beside the variation it belongs
                      to.
                    </p>
                  </CardBody>
                </Card>
              )}

              <ProductStockSection
                form={form}
                locations={locations}
                editing={editing}
                part="quantities"
              />
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardBody>
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
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={() => setStep((step - 1) as 1 | 2)}>
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === 3 ? (
            <Button key="save" type="submit" variant="primary">
              {editing ? 'Save changes' : 'Create product'}
            </Button>
          ) : (
            <Button
              key="continue"
              type="button"
              variant="primary"
              onClick={() => goTo((step + 1) as 2 | 3)}
            >
              Continue
            </Button>
          )}
        </div>
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
