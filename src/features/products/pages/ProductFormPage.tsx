import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFieldArray, useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
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
  useProduct,
  useUpdateProduct,
} from '../api/products'
import { PART_SIDES, productFormSchema, type ProductFormValues } from '../model/product'

const UNITS = [
  { value: 'pcs', label: 'pcs' },
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'l' },
  { value: 'm', label: 'm' },
  { value: 'pack', label: 'pack' },
] as const

const emptyVariation = () => ({
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
})

/**
 * Create and edit a product. One form for both, because they differ only in
 * where the values start.
 *
 * The variations editor is the substance of the screen: a product with no
 * variations cannot be sold, so the form refuses to save without at least one,
 * and every price, SKU and barcode is edited per variation rather than on the
 * product.
 *
 * Stock is deliberately absent. Quantities arrive through Goods receipt,
 * corrections and stocktaking — screens that leave a document behind. Typing a
 * number here would create stock with no record of where it came from.
 */
export default function ProductFormPage() {
  const navigate = useNavigate()
  const { productId } = useParams()
  const editing = Boolean(productId && productId !== 'new')

  const { data: existing } = useProduct(editing ? productId! : '')
  const { data: categories } = useCategories()
  const { data: brands } = useBrands()
  const create = useCreateProduct()
  const update = useUpdateProduct(productId ?? '')

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
            variations: [emptyVariation()],
          },
    [existing],
  )

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variations' })
  const variations = form.watch('variations')

  const onSubmit = form.handleSubmit((values) => {
    // Duplicate SKUs inside one product would make two rows indistinguishable
    // in the catalogue, so they are caught here rather than at the store.
    const skus = values.variations.map((v) => v.sku.trim().toLowerCase())
    const duplicate = skus.findIndex((sku, i) => skus.indexOf(sku) !== i)
    if (duplicate > -1) {
      form.setError(`variations.${duplicate}.sku`, { message: 'Already used by another variation' })
      return
    }

    const payload = { ...values, variations: values.variations } as never
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
  })

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
        description="A product describes the part. Its variations are what actually get sold."
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

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Variations</CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append(emptyVariation())}
              >
                <Plus />
                Add variation
              </Button>
            </CardHeader>
            <CardBody className="space-y-3">
              {form.formState.errors.variations?.root ? (
                <p className="text-danger text-2xs">
                  {form.formState.errors.variations.root.message}
                </p>
              ) : null}

              {fields.map((field, index) => (
                <div key={field.id} className="border-border rounded-card space-y-3 border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-fg-muted text-2xs font-semibold tracking-wide uppercase">
                      Variation {index + 1}
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
                          append({ ...rest, sku: `${source.sku}-COPY` })
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

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Name"
                      required
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
                              onChange={(v) => f.onChange(v)}
                              options={PART_SIDES}
                              placeholder="Not sided"
                            />
                          )}
                        />
                      )}
                    </Field>

                    <Field label="Cost" hint="What the supplier invoices">
                      {(p) => (
                        <div className="flex gap-1.5">
                          <Input
                            {...p}
                            type="number"
                            step="any"
                            className="text-right"
                            {...form.register(`variations.${index}.costPrice`, {
                              valueAsNumber: true,
                            })}
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
                    <Field label="Sale price" required>
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          className="text-right"
                          {...form.register(`variations.${index}.salePrice`, {
                            valueAsNumber: true,
                          })}
                        />
                      )}
                    </Field>
                    <Field label="Discounted price" hint="Leave empty for none">
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          className="text-right"
                          {...form.register(`variations.${index}.discountPrice`, {
                            setValueAs: (v) => (v === '' ? null : Number(v)),
                          })}
                        />
                      )}
                    </Field>
                    <Field label="Reorder point" hint="Warn below this">
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          className="text-right"
                          {...form.register(`variations.${index}.lowStockThreshold`, {
                            setValueAs: (v) => (v === '' ? null : Number(v)),
                          })}
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
                    <Field label="MOQ" hint="Supplier minimum">
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          className="text-right"
                          {...form.register(`variations.${index}.moq`, {
                            setValueAs: (v) => (v === '' ? null : Number(v)),
                          })}
                        />
                      )}
                    </Field>
                  </div>
                </div>
              ))}

              <p className="text-fg-subtle text-2xs">
                Stock is not set here. Quantities arrive through Goods receipt, corrections and
                stocktaking, so every change leaves a document behind.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Product</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Name" required error={form.formState.errors.name?.message}>
                {(p) => <Input {...p} {...form.register('name')} />}
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
              <Field label="Supplier brand">
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
              <Field label="Tags">
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
            <CardBody className="space-y-3">
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
                  <Input
                    {...p}
                    type="number"
                    step="any"
                    {...form.register('cargoWeightKg', {
                      setValueAs: (v) => (v === '' ? null : Number(v)),
                    })}
                  />
                )}
              </Field>
              <Field label="Cargo size">
                {(p) => <Input {...p} placeholder="120*60*30" {...form.register('cargoSize')} />}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
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
      </div>
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
        <div className="flex items-start justify-between gap-3">
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
