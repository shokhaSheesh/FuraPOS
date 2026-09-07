import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { useStartStocktake } from '../api/stocktakes'
import { stocktakeDraftSchema, type StocktakeDraft } from '../model/stocktake'

/**
 * Open a count.
 *
 * Deliberately three fields. The work of a stocktake is walking the aisle, not
 * filling in a form, so this exists only to decide what is in scope and then
 * get out of the way.
 *
 * Scope matters more than it looks: counting a whole warehouse in one session
 * is a day nobody has, so counting one category at a time — the brakes aisle
 * this morning, filters tomorrow — is how it actually gets done. The line count
 * is shown before starting, because "this is 184 lines" changes the decision.
 */
export default function NewStocktakePage() {
  const navigate = useNavigate()
  const locations = useDataStore((s) => s.locations)
  const categories = useDataStore((s) => s.categories)
  const variations = useDataStore((s) => s.variations)
  const start = useStartStocktake()

  const form = useForm<StocktakeDraft>({
    resolver: zodResolver(stocktakeDraftSchema),
    defaultValues: { locationId: locations[0]?.id ?? '', categoryId: '', comment: '' },
  })

  const locationId = form.watch('locationId')
  const categoryId = form.watch('categoryId')

  // The same rule the store uses to build the sheet, so the preview cannot
  // promise a different number from the one that appears.
  const lineCount = useMemo(
    () =>
      variations.filter((variation) => {
        if (variation.status === 'archived') return false
        if (categoryId && variation.categoryId !== categoryId) return false
        return variation.stockByLocation.some((row) => row.locationId === locationId)
      }).length,
    [variations, locationId, categoryId],
  )

  const submit = form.handleSubmit(
    (values) => {
      if (lineCount === 0) {
        toast.error('Nothing to count with that scope')
        return
      }
      start.mutate(values, {
        onSuccess: (stocktake) => {
          toast.success(`${stocktake.number} opened — ${formatNumber(lineCount)} lines to count`)
          navigate(paths.products.stocktakeDetail(stocktake.id))
        },
      })
    },
    () => toast.error('Check the highlighted fields'),
  )

  const location = locations.find((l) => l.id === locationId)

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.stocktaking}>
          <ArrowLeft />
          Stocktaking
        </Link>
      </Button>

      <PageHeader
        title="Start a count"
        description="Freeze what the system believes, then go and see what is really there."
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(paths.products.stocktaking)}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={submit}>
              <ClipboardList />
              Open the sheet
            </Button>
          </div>
        }
      />

      <div className="mt-4 max-w-2xl space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>What to count</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
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
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    />
                  )}
                />
              )}
            </Field>

            <Field
              label="Scope"
              hint="Counting one category at a time is how a warehouse gets counted at all"
            >
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
                      placeholder="The whole location"
                      options={categories.map((c) => ({ value: c.id, label: c.path }))}
                    />
                  )}
                />
              )}
            </Field>

            <Field label="Comment" hint="Why this count is happening">
              {(p) => <Input {...p} placeholder="Monthly count" {...form.register('comment')} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <p className="text-fg-muted text-sm">
              This sheet will have{' '}
              <span className="text-fg font-semibold">{formatNumber(lineCount)} lines</span> —
              everything {location?.name ?? 'the location'} carries
              {categoryId ? ' in that category' : ''}, including anything the system says is at
              zero.
            </p>
            <p className="text-fg-subtle text-2xs mt-1">
              Lines nobody counts are left exactly as they are. An empty count is not a write-off.
            </p>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
