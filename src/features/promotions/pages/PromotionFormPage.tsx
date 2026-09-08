import { Link, useNavigate, useParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, Tag } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { DatePicker } from '@/shared/ui/DatePicker'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatMoney } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { usePromotion, usePromotionActions } from '../api/promotions'
import {
  PROMOTION_KINDS,
  PROMOTION_SCOPES,
  promotionDraftSchema,
  type PromotionDraft,
} from '../model/promotion'

/** A basket to show the rule against, so the numbers mean something. */
const EXAMPLE_SALE = 3_000_000

/**
 * Setting up a promotion.
 *
 * The panel at the bottom spells the rule out as a sentence and works it
 * through on an example sale. Three abstract fields — kind, value, scope —
 * cannot tell anyone whether they have just written "15% off brakes" or "15 000
 * off everything", and the difference is a lot of money.
 */
export default function PromotionFormPage() {
  const { promotionId } = useParams()
  const navigate = useNavigate()
  const categories = useDataStore((s) => s.categories)
  const brands = useDataStore((s) => s.brands)
  const { data: existing } = usePromotion(promotionId)
  const actions = usePromotionActions()
  const editing = Boolean(promotionId)

  const form = useForm<PromotionDraft>({
    resolver: zodResolver(promotionDraftSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          kind: existing.kind,
          value: existing.value,
          scope: existing.scope,
          scopeId: existing.scopeId,
          startsAt: existing.startsAt,
          endsAt: existing.endsAt,
          paused: existing.paused,
          minimumSale: existing.minimumSale,
          comment: existing.comment,
        }
      : {
          name: '',
          kind: 'percentage',
          value: 10,
          scope: 'all',
          scopeId: null,
          startsAt: new Date().toISOString(),
          endsAt: null,
          paused: false,
          minimumSale: null,
          comment: '',
        },
  })

  const values = form.watch()

  if (editing && !existing) {
    return (
      <EmptyState
        title="No such promotion"
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.marketing.promotions}>Back to promotions</Link>
          </Button>
        }
      />
    )
  }

  const scopeOptions =
    values.scope === 'category'
      ? categories.map((c) => ({ value: c.id, label: c.name }))
      : brands.map((b) => ({ value: b.id, label: b.name }))

  const scopeName =
    values.scope === 'all'
      ? 'everything'
      : (scopeOptions.find((o) => o.value === values.scopeId)?.label ?? 'a selection')

  const exampleDiscount =
    values.kind === 'percentage'
      ? Math.round((EXAMPLE_SALE * (values.value || 0)) / 100)
      : Math.min(values.value || 0, EXAMPLE_SALE)
  const blockedByMinimum = values.minimumSale !== null && EXAMPLE_SALE < values.minimumSale

  const submit = form.handleSubmit(
    (draft) => {
      const input = {
        ...draft,
        scopeId: draft.scope === 'all' ? null : draft.scopeId,
        comment: draft.comment || null,
      }
      if (editing && existing) {
        actions.update(existing.id, input)
        toast.success('Saved')
      } else {
        actions.create(input)
        toast.success(`${draft.name} set up`)
      }
      navigate(paths.marketing.promotions)
    },
    () => toast.error('Check the highlighted fields'),
  )

  return (
    <form onSubmit={submit}>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.marketing.promotions}>
          <ArrowLeft />
          Promotions
        </Link>
      </Button>

      <PageHeader
        title={editing ? 'Edit promotion' : 'New promotion'}
        description="A discount with a reason and an end date. While it runs, the New sale screen applies it for the seller."
        action={
          <Button type="submit" variant="primary">
            <Save />
            {editing ? 'Save changes' : 'Set it up'}
          </Button>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>The offer</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required error={form.formState.errors.name?.message}>
              {(p) => (
                <Input {...p} placeholder="Autumn service check" {...form.register('name')} />
              )}
            </Field>
            <Field label="Discount type">
              {() => (
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <SegmentedControl
                      aria-label="Discount type"
                      value={field.value}
                      onChange={field.onChange}
                      options={PROMOTION_KINDS.map((entry) => ({
                        value: entry.value,
                        label: entry.label,
                      }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label={values.kind === 'percentage' ? 'Percent off' : 'Amount off'}
              required
              error={form.formState.errors.value?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={0}
                      value={field.value}
                      // A percentage over 100 is caught by the schema; clamping
                      // here as well stops the preview showing a negative sale
                      // while someone is still typing.
                      onChange={(next) =>
                        field.onChange(
                          values.kind === 'percentage' ? Math.min(next ?? 0, 100) : (next ?? 0),
                        )
                      }
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Smallest sale it applies to"
              hint="Leave empty to apply to any sale"
              error={form.formState.errors.minimumSale?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="minimumSale"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      min={0}
                      placeholder="Any sale"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What it applies to</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope">
              {(p) => (
                <Controller
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value}
                      onChange={(next) => {
                        field.onChange(next)
                        // The old id belongs to the old list and would silently
                        // scope the promotion to nothing.
                        form.setValue('scopeId', null)
                      }}
                      options={PROMOTION_SCOPES}
                    />
                  )}
                />
              )}
            </Field>
            {values.scope !== 'all' ? (
              <Field
                label={values.scope === 'category' ? 'Category' : 'Brand'}
                required
                error={form.formState.errors.scopeId?.message}
              >
                {(p) => (
                  <Controller
                    control={form.control}
                    name="scopeId"
                    render={({ field }) => (
                      <Select
                        {...p}
                        className="w-full"
                        placeholder="Pick one"
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        options={scopeOptions}
                      />
                    )}
                  />
                )}
              </Field>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>When it runs</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts">
              {() => (
                <Controller
                  control={form.control}
                  name="startsAt"
                  render={({ field }) => (
                    <DatePicker
                      className="w-full"
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange((date ?? new Date()).toISOString())}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Ends"
              hint="Leave empty to run until somebody stops it"
              error={form.formState.errors.endsAt?.message}
            >
              {() => (
                <Controller
                  control={form.control}
                  name="endsAt"
                  render={({ field }) => (
                    <DatePicker
                      className="w-full"
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange(date ? date.toISOString() : null)}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Note" className="sm:col-span-2">
              {(p) => (
                <Input {...p} placeholder="Why this is running" {...form.register('comment')} />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card className="bg-surface-inset">
          <CardBody className="flex items-start gap-2.5">
            <Tag className="text-fg-muted mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-fg text-sm font-medium">
                {values.kind === 'percentage'
                  ? `${values.value || 0}% off ${scopeName}`
                  : `${formatMoney(values.value || 0)} off ${scopeName}`}
              </p>
              <p className="text-fg-muted text-2xs">
                {blockedByMinimum
                  ? `A ${formatMoney(EXAMPLE_SALE)} sale would get nothing — it is below the ${formatMoney(
                      values.minimumSale ?? 0,
                    )} minimum.`
                  : `A ${formatMoney(EXAMPLE_SALE)} sale of matching goods would come down by ${formatMoney(
                      exampleDiscount,
                    )}, to ${formatMoney(EXAMPLE_SALE - exampleDiscount)}.`}
              </p>
              <p className="text-fg-subtle text-2xs">
                Only one promotion applies to a sale — whichever gives the customer the most.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
