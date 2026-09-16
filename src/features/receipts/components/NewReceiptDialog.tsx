import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { newReceiptSchema, type NewReceiptDraft } from '../model/receipt'
import { useSuppliers } from '../api/receipts'

/**
 * Everything the reference product asks before a receipt exists: where the
 * goods come from, where they land, at what rate their prices convert, and
 * whether posting them should also count the shelf.
 *
 * None of it is asked again later, and all of it changes what the product step
 * can do — which is why it is a gate in front of the receipt rather than a card
 * on it. Answering it creates an empty, unfinished receipt and opens it.
 */
export function NewReceiptDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (draft: NewReceiptDraft) => void
}) {
  const locations = useDataStore((s) => s.locations)
  const { data: suppliers } = useSuppliers()

  /** The zones we actually buy from, taken from the suppliers on file. */
  const zones = [...new Set(suppliers.items.map((s) => s.zone).filter(Boolean))] as string[]

  const form = useForm<NewReceiptDraft>({
    resolver: zodResolver(newReceiptSchema),
    defaultValues: {
      zone: '',
      locationId: '',
      usdRate: USD_RATE,
      stocktakeOnPost: false,
      supplierId: null,
      distributeByTransfer: false,
      comment: '',
    },
  })

  // Reopening it should not show the last attempt's answers or its errors.
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const supplierId = form.watch('supplierId')

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New receipt"
      size="lg"
      primary={{ label: 'Create', formId: 'new-receipt-form' }}
      secondaryLabel="Cancel"
    >
      <form
        id="new-receipt-form"
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => onCreate(values))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zone" required error={form.formState.errors.zone?.message}>
            {(p) => (
              <Controller
                control={form.control}
                name="zone"
                render={({ field }) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder="Where the goods ship from"
                    options={zones.map((zone) => ({ value: zone, label: zone }))}
                  />
                )}
              />
            )}
          </Field>

          <Field label="Location" required error={form.formState.errors.locationId?.message}>
            {(p) => (
              <Controller
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder="Where they land"
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  />
                )}
              />
            )}
          </Field>

          <Field
            label="Supplier price rate"
            required
            error={form.formState.errors.usdRate?.message}
            hint="Frozen on this receipt, so posting it later cannot re-price it"
          >
            {(p) => (
              <Controller
                control={form.control}
                name="usdRate"
                render={({ field }) => (
                  <div className="rounded-control border-border bg-surface flex h-9 items-center overflow-hidden border">
                    <span className="text-fg-muted bg-surface-inset border-border h-full shrink-0 border-r px-3 text-sm leading-9">
                      1 USD =
                    </span>
                    <NumberField
                      {...p}
                      className="h-full flex-1 rounded-none border-0 focus:ring-0"
                      nullable={false}
                      step="any"
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? 0)}
                      onBlur={field.onBlur}
                    />
                    <span className="text-fg-muted bg-surface-inset border-border h-full shrink-0 border-l px-3 text-sm leading-9">
                      UZS
                    </span>
                  </div>
                )}
              />
            )}
          </Field>

          <Field
            label="Count the shelf when posting these products?"
            required
            hint="Posts what is actually there, not what the paperwork says"
          >
            {() => (
              <Controller
                control={form.control}
                name="stocktakeOnPost"
                render={({ field }) => (
                  <SegmentedControl
                    aria-label="Count the shelf when posting"
                    value={field.value ? 'yes' : 'no'}
                    onChange={(v) => field.onChange(v === 'yes')}
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ]}
                  />
                )}
              />
            )}
          </Field>

          <Field label="Supplier" className="sm:col-span-2">
            {(p) => (
              <Controller
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                    placeholder="Supplier of your choice"
                    options={suppliers.items.map((s) => ({ value: s.id, label: s.name }))}
                  />
                )}
              />
            )}
          </Field>
        </div>

        {/* Boxed apart, as the reference does: it is not a property of the
            delivery but a decision about what happens after it lands. */}
        <div className="rounded-card border-border border p-4">
          <Field
            label="Spread the goods across locations with a transfer?"
            required
            hint="Everything lands at one location first, then moves on"
          >
            {() => (
              <Controller
                control={form.control}
                name="distributeByTransfer"
                render={({ field }) => (
                  <SegmentedControl
                    aria-label="Spread the goods across locations"
                    value={field.value ? 'yes' : 'no'}
                    onChange={(v) => field.onChange(v === 'yes')}
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ]}
                  />
                )}
              />
            )}
          </Field>
        </div>

        <Field label="Note">
          {(p) => (
            <Input
              {...p}
              placeholder={
                supplierId
                  ? 'Container 3, air freight — anything worth knowing later'
                  : 'Anything worth knowing when this is queried later'
              }
              {...form.register('comment')}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
