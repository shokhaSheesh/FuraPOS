import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import {
  boughtFromLabel,
  boughtFromPlaceholder,
  hasSupplierRecord,
  PROCUREMENT_KINDS,
} from '@/shared/types'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { newReceiptSchema, type NewReceiptDraft } from '../model/receipt'
import { useSuppliers } from '../api/receipts'
import { t } from '@/shared/i18n'

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
      kind: 'supplier',
      zone: '',
      locationId: '',
      usdRate: USD_RATE,
      stocktakeOnPost: false,
      supplierId: null,
      boughtFrom: '',
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
      title={t('New receipt')}
      size="lg"
      primary={{ label: t('Create'), formId: 'new-receipt-form' }}
      secondaryLabel="Cancel"
    >
      <form
        id="new-receipt-form"
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => onCreate(values))}
      >
        <Field label={t('Where these goods came from')} required>
          {() => (
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <div className="space-y-1">
                  <SegmentedControl
                    aria-label={t('Where these goods came from')}
                    value={field.value}
                    onChange={field.onChange}
                    options={PROCUREMENT_KINDS.map(({ value, label }) => ({
                      value,
                      label: t(label),
                    }))}
                  />
                  <p className="text-fg-subtle text-2xs">
                    {PROCUREMENT_KINDS.find((k) => k.value === field.value)?.hint}
                  </p>
                </div>
              )}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Zone')} required error={form.formState.errors.zone?.message}>
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
                    placeholder={t('Where the goods ship from')}
                    options={zones.map((zone) => ({ value: zone, label: zone }))}
                  />
                )}
              />
            )}
          </Field>

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
                    placeholder={t('Where they land')}
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  />
                )}
              />
            )}
          </Field>

          <Field
            label={t('Supplier price rate')}
            required
            error={form.formState.errors.usdRate?.message}
            hint={t('Frozen on this receipt, so posting it later cannot re-price it')}
          >
            {(p) => (
              <Controller
                control={form.control}
                name="usdRate"
                render={({ field }) => (
                  <div className="rounded-control border-border bg-surface flex h-9 items-center overflow-hidden border">
                    <span className="text-fg-muted bg-surface-inset border-border h-full shrink-0 border-r px-3 text-sm leading-9">
                      {t('1 USD =')}
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
                      {t('UZS')}
                    </span>
                  </div>
                )}
              />
            )}
          </Field>

          <Field
            label={t('Count the shelf when posting these products?')}
            required
            hint={t('Posts what is actually there, not what the paperwork says')}
          >
            {() => (
              <Controller
                control={form.control}
                name="stocktakeOnPost"
                render={({ field }) => (
                  <SegmentedControl
                    aria-label={t('Count the shelf when posting')}
                    value={field.value ? 'yes' : 'no'}
                    onChange={(v) => field.onChange(v === 'yes')}
                    options={[
                      { value: 'yes', label: t('Yes') },
                      { value: 'no', label: t('No') },
                    ]}
                  />
                )}
              />
            )}
          </Field>

          {/* One question, two different answers: a supplier is a record we
              hold, the bazaar and a factory are a name somebody types. */}
          {hasSupplierRecord(kind) ? (
            <Field
              label={t('Supplier')}
              required
              error={form.formState.errors.supplierId?.message}
              className="sm:col-span-2"
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
                      placeholder={t('Supplier of your choice')}
                      options={suppliers.items.map((s) => ({ value: s.id, label: s.name }))}
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
              className="sm:col-span-2"
              hint={t(
                'There is no account to build a debt against — a market buy is paid on the spot',
              )}
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
        </div>

        <Field label={t('Note')}>
          {(p) => (
            <Input
              {...p}
              placeholder={t('Container 3, air freight — anything worth knowing later')}
              {...form.register('comment')}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
