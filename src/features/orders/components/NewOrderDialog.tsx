import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field } from '@/shared/components/Field'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { boughtFromLabel, boughtFromPlaceholder, hasSupplierRecord } from '@/shared/types'
import { useDataStore } from '@/data/store'
import { ORDER_KINDS } from '../model/order'
import { t } from '@/shared/i18n'

/**
 * Everything decided before an order exists: who it is with, where it should
 * land, and when it is wanted.
 *
 * A gate rather than a card on the order, for the same reason the receipt's is
 * one — the answers change what the product step can even show. A supplier
 * order is picked from *their* catalogue, so until a supplier is named there
 * is nothing to pick from.
 */
export const newOrderSchema = z
  .object({
    kind: z.enum(['supplier', 'market', 'china']),
    supplierId: z.string().nullable(),
    boughtFrom: z.string(),
    locationId: z.string().min(1, 'Pick where it should land'),
    expectedAt: z.string().nullable(),
    comment: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === 'supplier' && !values.supplierId) {
      ctx.addIssue({ code: 'custom', path: ['supplierId'], message: 'Pick who this order goes to' })
    }
    if (values.kind !== 'supplier' && !values.boughtFrom.trim()) {
      ctx.addIssue({ code: 'custom', path: ['boughtFrom'], message: 'Say where it comes from' })
    }
  })

export type NewOrderDraft = z.infer<typeof newOrderSchema>

export function NewOrderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (draft: NewOrderDraft) => void
}) {
  const locations = useDataStore((s) => s.locations)
  const suppliers = useDataStore((s) => s.suppliers)

  const form = useForm<NewOrderDraft>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: {
      kind: 'supplier',
      supplierId: null,
      boughtFrom: '',
      locationId: locations[0]?.id ?? '',
      expectedAt: null,
      comment: '',
    },
  })

  // Reopening it should not show the last attempt's answers or its errors.
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const kind = form.watch('kind')

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('New order')}
      size="lg"
      primary={{ label: t('Create'), formId: 'new-order-form' }}
      secondaryLabel="Cancel"
    >
      <form
        id="new-order-form"
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => onCreate(values))}
      >
        <Field label={t('Where this order goes')} required>
          {() => (
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <div className="space-y-1">
                  <SegmentedControl
                    aria-label={t('Where this order goes')}
                    value={field.value}
                    onChange={field.onChange}
                    options={ORDER_KINDS.map(({ value, label }) => ({ value, label }))}
                  />
                  <p className="text-fg-subtle text-2xs">
                    {t(ORDER_KINDS.find((k) => k.value === field.value)?.hint ?? '')}
                  </p>
                </div>
              )}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {hasSupplierRecord(kind) ? (
            <Field
              label={t('Supplier')}
              required
              error={form.formState.errors.supplierId?.message}
              hint={t('The order is built from their catalogue')}
            >
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
                      placeholder={t('Who this goes to')}
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  )}
                />
              )}
            </Field>
          ) : (
            <Field
              label={boughtFromLabel(kind)}
              required
              error={form.formState.errors.boughtFrom?.message}
              hint={t('Picked from our own catalogue, since they have none here')}
            >
              {(p) => (
                <Input
                  {...p}
                  placeholder={boughtFromPlaceholder(kind)}
                  {...form.register('boughtFrom')}
                />
              )}
            </Field>
          )}

          <Field label={t('Location')} required error={form.formState.errors.locationId?.message}>
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
                    placeholder={t('Where it should land')}
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  />
                )}
              />
            )}
          </Field>

          <Field
            label={t('Expected')}
            className="sm:col-span-2"
            hint={t(
              'When they said it would arrive. Leave it empty if nothing was promised — an order cannot be late against a date nobody gave.',
            )}
          >
            {() => (
              <Controller
                control={form.control}
                name="expectedAt"
                render={({ field }) => (
                  <DatePicker
                    className="w-full"
                    // The order carries an ISO string; the picker deals in
                    // dates, so the conversion happens at the boundary.
                    value={field.value ? new Date(field.value) : null}
                    onChange={(date) => field.onChange(date ? date.toISOString() : null)}
                  />
                )}
              />
            )}
          </Field>
        </div>

        <Field label={t('Note')}>
          {(p) => (
            <Input
              {...p}
              placeholder={t('Container 4, Q3 restock')}
              {...form.register('comment')}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
