import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Calculator } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useCreateRepricing } from '../api/repricings'
import {
  defaultRuleValue,
  marginOf,
  priceUnder,
  repricingDraftSchema,
  ROUNDING_OPTIONS,
  RULE_KINDS,
  type RepricingDraft,
} from '../model/repricing'

/**
 * Set up a price change.
 *
 * Nothing here changes a price — it prepares a sheet to review. That separation
 * is the safety: a bulk rule is easy to get wrong by a decimal place, and the
 * gap between "prepare" and "apply" is where someone notices.
 *
 * The preview earns its space by showing three real products under the rule, so
 * a mistake is visible as a wrong number rather than as an abstract percentage.
 */
export default function NewRepricingPage() {
  const navigate = useNavigate()
  const categories = useDataStore((s) => s.categories)
  const brands = useDataStore((s) => s.brands)
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const create = useCreateRepricing()

  const form = useForm<RepricingDraft>({
    resolver: zodResolver(repricingDraftSchema),
    defaultValues: {
      kind: 'percent',
      value: 5,
      roundTo: 1000,
      categoryId: '',
      brandId: '',
      locationId: '',
      comment: '',
    },
  })

  const kind = form.watch('kind')
  const value = form.watch('value')
  const roundTo = form.watch('roundTo')
  const categoryId = form.watch('categoryId')
  const brandId = form.watch('brandId')
  const locationId = form.watch('locationId')

  const scope = useMemo(
    () =>
      variations.filter((variation) => {
        if (variation.status === 'archived') return false
        if (categoryId && variation.categoryId !== categoryId) return false
        if (brandId && variation.brandId !== brandId) return false
        if (locationId && !variation.stockByLocation.some((r) => r.locationId === locationId)) {
          return false
        }
        return true
      }),
    [variations, categoryId, brandId, locationId],
  )

  const rule = { kind, value, roundTo }
  const preview = scope.slice(0, 3).map((variation) => {
    const costAtTime =
      variation.costCurrency === 'USD' ? variation.costPrice * USD_RATE : variation.costPrice
    const line = { oldPrice: variation.salePrice, costAtTime }
    return { variation, costAtTime, newPrice: priceUnder(rule, line) }
  })

  const submit = form.handleSubmit(
    (values) => {
      if (scope.length === 0) {
        toast.error('No products match that scope')
        return
      }
      create.mutate(
        {
          rule: { kind: values.kind, value: values.value, roundTo: values.roundTo },
          categoryId: values.categoryId,
          brandId: values.brandId,
          locationId: values.locationId,
          comment: values.comment,
        },
        {
          onSuccess: (repricing) => {
            toast.success(`${repricing.number} prepared — review before applying`)
            navigate(paths.products.repricingDetail(repricing.id))
          },
        },
      )
    },
    () => toast.error('Check the highlighted fields'),
  )

  const valueLabel =
    kind === 'percent'
      ? 'Percentage'
      : kind === 'amount'
        ? 'Amount'
        : kind === 'margin'
          ? 'Target margin'
          : ''

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.repricing}>
          <ArrowLeft />
          Repricing
        </Link>
      </Button>

      <PageHeader
        title="New price change"
        description="Work out the new prices now, review them, then apply. Nothing changes until you do."
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(paths.products.repricing)}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={submit}>
              <Calculator />
              Work out the prices
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Which products</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Category" hint="Leave empty for the whole catalogue">
              {(p) => (
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder="Every category"
                      options={categories.map((c) => ({ value: c.id, label: c.path }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Supplier brand" hint="Useful when one supplier raises their prices">
              {(p) => (
                <Controller
                  control={form.control}
                  name="brandId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder="Every brand"
                      options={brands.map((b) => ({ value: b.id, label: b.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Location"
              hint="Narrows to what that shelf carries — the price itself is the same everywhere"
            >
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
                      placeholder="Every location"
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <p className="text-fg-muted text-sm">
              <span className="text-fg font-semibold">{formatNumber(scope.length)} products</span>{' '}
              match. Prices that do not move are still listed, so the sheet shows what was
              considered.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to change them</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Rule" required hint={RULE_KINDS.find((r) => r.value === kind)?.hint}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value}
                      onChange={(next) => {
                        field.onChange(next)
                        // The number means something different under each rule,
                        // so carrying it over would quietly compute nonsense.
                        form.setValue('value', defaultRuleValue(next))
                      }}
                      options={RULE_KINDS.map((r) => ({ value: r.value, label: r.label }))}
                    />
                  )}
                />
              )}
            </Field>

            {kind === 'manual' ? null : (
              <Field
                label={valueLabel}
                required
                hint={
                  kind === 'percent'
                    ? 'Negative lowers prices — −5 takes five per cent off'
                    : kind === 'margin'
                      ? 'What share of the price should be profit, as a percentage'
                      : 'Negative subtracts'
                }
              >
                {(p) => (
                  <Controller
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <NumberField
                        {...p}
                        nullable={false}
                        min={kind === 'margin' ? 0 : -1_000_000_000}
                        step="any"
                        // Margin is stored as a fraction but read as a percentage:
                        // nobody types 0.3 when they mean thirty per cent.
                        value={kind === 'margin' ? Math.round(field.value * 100) : field.value}
                        onChange={(next) =>
                          field.onChange(kind === 'margin' ? (next ?? 0) / 100 : (next ?? 0))
                        }
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                )}
              </Field>
            )}

            <Field label="Round to" hint="Bulk arithmetic produces prices nobody would print">
              {(p) => (
                <Controller
                  control={form.control}
                  name="roundTo"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={String(field.value)}
                      onChange={(next) => field.onChange(Number(next))}
                      options={ROUNDING_OPTIONS}
                    />
                  )}
                />
              )}
            </Field>

            <Field label="Reason" hint="What prompted this — the question asked six months later">
              {(p) => (
                <Input {...p} placeholder="Exchange rate moved" {...form.register('comment')} />
              )}
            </Field>
          </CardBody>
        </Card>
      </div>

      {preview.length > 0 ? (
        <Card className="mt-3">
          <CardHeader className="flex-col items-stretch gap-1">
            <CardTitle>What that does</CardTitle>
            <p className="text-fg-subtle text-2xs">
              Three of the {formatNumber(scope.length)} products, under this rule.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas">
                  <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                    <th className="px-4 py-2 text-left font-semibold">Product</th>
                    <th className="px-4 py-2 text-right font-semibold">Cost</th>
                    <th className="px-4 py-2 text-right font-semibold">Now</th>
                    <th className="px-4 py-2 text-right font-semibold">Would become</th>
                    <th className="px-4 py-2 text-right font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(({ variation, costAtTime, newPrice }) => {
                    const below = costAtTime > 0 && newPrice < costAtTime
                    return (
                      <tr key={variation.id} className="border-border border-t">
                        <td className="text-fg px-4 py-2">{variation.fullName}</td>
                        <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                          {formatMoney(Math.round(costAtTime))}
                        </td>
                        <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                          {formatMoney(variation.salePrice)}
                        </td>
                        <td className="text-fg px-4 py-2 text-right font-medium tabular-nums">
                          {formatMoney(newPrice)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            below ? 'text-danger font-medium' : 'text-fg-muted'
                          }`}
                        >
                          {below ? 'below cost' : formatPercent(marginOf(newPrice, costAtTime))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </form>
  )
}
