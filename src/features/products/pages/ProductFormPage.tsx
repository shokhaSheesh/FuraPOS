import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFieldArray, useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react'
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
import {
  PART_SIDES,
  productFormSchema,
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

/** The name a single-variation product's one variation is stored under. */
const SINGLE_VARIATION_NAME = 'Standard'

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

const emptyVariation = (locations: readonly { id: string }[]) => ({
  name: '',
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
            variationMode: existing.variations.length > 1 ? 'multiple' : 'single',
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
              name: v.name,
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

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variations' })
  const variations = form.watch('variations')
  const mode = form.watch('variationMode')
  const single = mode === 'single'
  const productName = form.watch('name')

  /** What a variation will actually be called once it is saved. */
  const sellableName = (index: number) => {
    const label = variations[index]?.name?.trim()
    const base = productName.trim() || 'Product'
    return label ? `${base} — ${label}` : base
  }

  const setMode = (next: VariationMode) => {
    if (next === mode) return
    if (next === 'single' && fields.length > 1) {
      setConfirmCollapse(true)
      return
    }
    if (next === 'multiple' && form.getValues('variations.0.name') === SINGLE_VARIATION_NAME) {
      // "Standard" was our placeholder, not the user's word for it.
      form.setValue('variations.0.name', '')
    }
    form.setValue('variationMode', next, { shouldDirty: true })
  }

  const collapseToSingle = () => {
    form.setValue('variations', [form.getValues('variations.0')], { shouldDirty: true })
    form.setValue('variationMode', 'single', { shouldDirty: true })
    form.clearErrors('variations')
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

      const kept =
        values.variationMode === 'single' ? values.variations.slice(0, 1) : values.variations
      const payload = {
        ...values,
        variations: kept.map((variation) => ({
          ...variation,
          // Storage does not know about the mode: a single product is still one
          // variation, and it needs a name for the places that list variations.
          name: values.variationMode === 'single' ? SINGLE_VARIATION_NAME : variation.name.trim(),
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
                  : `Several sellable things. Each gets a short label that extends the product name — “${
                      productName || 'Brake disc HD72'
                    } — Left”.`}
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
                  : 'Each one has its own barcode, price and stock.'}
              </p>
            </div>
            {single ? null : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append(emptyVariation(locations))}
              >
                <Plus />
                Add variation
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-3">
            {form.formState.errors.variations?.root ? (
              <p className="text-danger text-2xs">
                {form.formState.errors.variations.root.message}
              </p>
            ) : null}

            {fields.map((field, index) => (
              <div
                key={field.id}
                className={single ? '' : 'border-border rounded-card space-y-3 border p-3'}
              >
                {single ? null : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-fg text-sm font-medium">
                      {sellableName(index)}
                      {variations[index]?.name?.trim() ? null : (
                        <span className="text-fg-subtle text-2xs ml-2 font-normal">
                          — add a label
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Duplicate variation"
                        title="Duplicate"
                        onClick={() => {
                          // Left/right pairs differ by a character; copying and
                          // editing beats retyping eleven fields. The copy gets
                          // no id, so it saves as a new variation.
                          const source = variations[index]
                          if (!source) return
                          const { id: _ignored, ...rest } = source
                          append({
                            ...rest,
                            sku: `${source.sku}-COPY`,
                            // Stock is counted, not copied.
                            stockByLocation: stockRows(locations),
                          })
                        }}
                      >
                        <Copy />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove variation"
                        title={fields.length === 1 ? 'A product needs one variation' : 'Remove'}
                        disabled={fields.length === 1}
                        className="hover:text-danger"
                        onClick={() => remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {single ? null : (
                    <Field
                      label="Variation label"
                      required
                      hint="Only what tells this one apart, not the whole name"
                      error={form.formState.errors.variations?.[index]?.name?.message}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="Left"
                          {...form.register(`variations.${index}.name`)}
                        />
                      )}
                    </Field>
                  )}
                  <Field
                    label="SKU"
                    required
                    error={form.formState.errors.variations?.[index]?.sku?.message}
                  >
                    {(p) => <Input {...p} {...form.register(`variations.${index}.sku`)} />}
                  </Field>
                  <Field label="Barcode">
                    {(p) => <Input {...p} {...form.register(`variations.${index}.barcode`)} />}
                  </Field>
                  <Field label="Side">
                    {(p) => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.partSide`}
                        render={({ field: f }) => (
                          <Select
                            {...p}
                            className="w-full"
                            value={f.value ?? undefined}
                            onChange={(v) => {
                              f.onChange(v)
                              // Side is the label for most parts here, so
                              // picking one fills an empty label rather than
                              // making the user type "Left" a second time.
                              if (single || form.getValues(`variations.${index}.name`).trim())
                                return
                              const side = PART_SIDES.find((s) => s.value === v)
                              if (side) form.setValue(`variations.${index}.name`, side.label)
                            }}
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
                    error={form.formState.errors.variations?.[index]?.costPrice?.message}
                  >
                    {(p) => (
                      <div className="flex gap-1.5">
                        <Controller
                          control={form.control}
                          name={`variations.${index}.costPrice`}
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
                          name={`variations.${index}.costCurrency`}
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
                    error={form.formState.errors.variations?.[index]?.salePrice?.message}
                  >
                    {(p) => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.salePrice`}
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
                  <Field
                    label="Discounted price"
                    hint="Leave empty for none"
                    error={form.formState.errors.variations?.[index]?.discountPrice?.message}
                  >
                    {(p) => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.discountPrice`}
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
                  <Field
                    label="Reorder point"
                    hint="Warn below this"
                    error={form.formState.errors.variations?.[index]?.lowStockThreshold?.message}
                  >
                    {(p) => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.lowStockThreshold`}
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
                        {...form.register(`variations.${index}.shelfAddress`)}
                      />
                    )}
                  </Field>
                  <Field
                    label="MOQ"
                    hint="Supplier minimum"
                    error={form.formState.errors.variations?.[index]?.moq?.message}
                  >
                    {(p) => (
                      <Controller
                        control={form.control}
                        name={`variations.${index}.moq`}
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
              </div>
            ))}
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
        title="Keep only the first variation?"
        confirmLabel="Keep the first"
        body={`This product has ${fields.length} variations. Switching to one keeps “${
          variations[0]?.name?.trim() || variations[0]?.sku || 'the first'
        }” and drops the rest, along with their stock.`}
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
