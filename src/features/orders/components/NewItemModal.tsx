import { useEffect, useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { toast } from '@/shared/ui/toast'
import { useDataStore } from '@/data/store'
import { useCreateProduct } from '@/features/products/api/products'
import type { UnitOfMeasure, VariationRow } from '@/features/products/model/product'

const UNITS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'l', label: 'Litres' },
  { value: 'm', label: 'Metres' },
  { value: 'pack', label: 'Packs' },
]

const NO_BRAND = '__none__'

/**
 * Adding something we have never carried, from the order screen.
 *
 * A bazaar run turns up parts that are not in the catalogue, and the order
 * should not wait on somebody opening the product form in another tab. So this
 * asks for the least that makes it a real product — what it is, where it
 * belongs, what it cost and what it sells for — and puts it straight on the
 * order.
 *
 * It is a **real product**, not a one-off line. Once it arrives it is stock on
 * a shelf that has to be found, counted and sold, and all of that needs it in
 * the catalogue. Anything left out here can be filled in on the product later.
 */
export function NewItemModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (variation: VariationRow) => void
}) {
  const categories = useDataStore((s) => s.categories)
  const brands = useDataStore((s) => s.brands)
  const products = useDataStore((s) => s.products)
  const create = useCreateProduct()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState(NO_BRAND)
  const [unit, setUnit] = useState<UnitOfMeasure>('pcs')
  const [costPrice, setCostPrice] = useState<number | null>(null)
  const [salePrice, setSalePrice] = useState<number | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setCategoryId('')
    setBrandId(NO_BRAND)
    setUnit('pcs')
    setCostPrice(null)
    setSalePrice(null)
    setShowErrors(false)
  }, [open])

  const errors = {
    name: name.trim().length < 2 ? 'What is it called?' : undefined,
    categoryId: !categoryId ? 'Pick where it belongs' : undefined,
    costPrice: !costPrice ? 'What did it cost?' : undefined,
    salePrice: !salePrice ? 'What will it sell for?' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const save = () => {
    setShowErrors(true)
    if (!valid) return

    const sku = `SKU-${String(products.length + 1).padStart(5, '0')}`
    create.mutate(
      {
        name: name.trim(),
        description: null,
        categoryId,
        brandId: brandId === NO_BRAND ? null : brandId,
        manufacturer: null,
        tags: [],
        unit,
        vehicleMake: null,
        vehicleModels: [],
        cargoWeightKg: null,
        cargoSize: null,
        isShippable: true,
        showOnline: false,
        options: [],
        status: 'active',
        variations: [
          {
            optionValues: [],
            sku,
            barcode: null,
            partSide: null,
            // Bought with cash at the market, so the price is in sum.
            costPrice: costPrice!,
            costCurrency: 'UZS',
            salePrice: salePrice!,
            discountPrice: null,
            // Nothing is on a shelf yet — it lands when the order is received.
            stockByLocation: [],
            lowStockThreshold: null,
            shelfAddress: null,
            moq: null,
            status: 'active',
          },
        ],
      },
      {
        onSuccess: (product) => {
          const variation = useDataStore
            .getState()
            .variations.find((v) => v.productId === product.id)
          if (!variation) return
          toast.success(`${product.name} added to the catalogue`)
          onCreated(variation)
          onOpenChange(false)
        },
      },
    )
  }

  const err = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined)

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add an item we don't carry"
      description="It becomes a product in the catalogue and goes straight on this order. The rest of its details can be filled in later."
      primary={{ label: 'Add and put on the order', onClick: save }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required error={err('name')} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              placeholder="Brake hose 40 cm"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Category" required error={err('categoryId')}>
          {(p) => (
            <Select
              {...p}
              className="w-full"
              value={categoryId || undefined}
              onChange={setCategoryId}
              placeholder="Pick a category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
        </Field>
        <Field label="Brand">
          {(p) => (
            <Select
              {...p}
              className="w-full"
              value={brandId}
              onChange={setBrandId}
              options={[
                { value: NO_BRAND, label: 'No brand' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          )}
        </Field>
        <Field label="Unit">
          {(p) => (
            <Select {...p} className="w-full" value={unit} onChange={setUnit} options={UNITS} />
          )}
        </Field>
        <div />
        <Field label="Cost price, UZS" required error={err('costPrice')}>
          {(p) => (
            <NumberField
              {...p}
              className="w-full"
              value={costPrice}
              onChange={setCostPrice}
              placeholder="What it cost at the market"
            />
          )}
        </Field>
        <Field label="Sale price, UZS" required error={err('salePrice')}>
          {(p) => (
            <NumberField
              {...p}
              className="w-full"
              value={salePrice}
              onChange={setSalePrice}
              placeholder="What we will sell it for"
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
