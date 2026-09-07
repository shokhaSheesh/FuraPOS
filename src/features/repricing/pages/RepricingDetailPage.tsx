import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Check, Search, Undo2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { NumberField } from '@/shared/components/NumberField'
import { StatusChips } from '@/shared/components/StatusChips'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { matches } from '@/data/query'
import { useRepricing, useRepricingActions } from '../api/repricings'
import {
  averageChange,
  belowCost,
  canApply,
  canRevert,
  changedLines,
  lineChange,
  loweredCount,
  marginOf,
  marginShift,
  raisedCount,
  repricingStatusLabel,
  repricingStatusTone,
} from '../model/repricing'

type Lens = 'all' | 'changed' | 'risky'

/**
 * The price sheet: every line the rule touched, old beside new, with the margin
 * each price implies.
 *
 * Margin is the column that stops a mistake. A bulk percentage looks harmless
 * until it puts a part below what it cost — which is why "Below cost" is a lens
 * of its own, and why applying warns before it lets that through.
 *
 * Prices stay editable while it is a draft, because a rule gets ninety per cent
 * of a repricing right and the last ten per cent is judgement.
 */
export default function RepricingDetailPage() {
  const navigate = useNavigate()
  const { repricingId } = useParams()
  const { can } = useSession()
  const { data: repricing } = useRepricing(repricingId ?? '')
  const actions = useRepricingActions(repricingId ?? '')
  const [lens, setLens] = useState<Lens>('all')
  const [term, setTerm] = useState('')
  const [confirmApply, setConfirmApply] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)

  const visible = useMemo(() => {
    if (!repricing) return []
    return repricing.lines.filter((line) => {
      if (lens === 'changed' && lineChange(line) === 0) return false
      if (lens === 'risky' && !(line.costAtTime > 0 && line.newPrice < line.costAtTime))
        return false
      return matches([line.name, line.sku, line.categoryName], term)
    })
  }, [repricing, lens, term])

  if (!repricing) {
    return <EmptyState title="Price change not found" description="It may have been deleted." />
  }

  const draft = canApply(repricing.status)
  const changed = changedLines(repricing)
  const risky = belowCost(repricing)
  const shift = marginShift(repricing)
  const canSeeCost = can('products.cost.view')

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.repricing}>
          <ArrowLeft />
          Repricing
        </Link>
      </Button>

      <PageHeader
        title={repricing.number}
        description={`${formatNumber(repricing.lines.length)} products${
          repricing.categoryName ? ` in ${repricing.categoryName}` : ''
        }${repricing.brandName ? ` from ${repricing.brandName}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {canRevert(repricing.status) && can('products.repricing.delete') ? (
              <Button variant="secondary" onClick={() => setConfirmRevert(true)}>
                <Undo2 />
                Put prices back
              </Button>
            ) : null}
            {draft && can('products.repricing.edit') ? (
              <Button
                variant="primary"
                disabled={changed.length === 0}
                onClick={() => setConfirmApply(true)}
              >
                <Check />
                Apply to {formatNumber(changed.length)} products
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={repricingStatusTone(repricing.status)}>
              {repricingStatusLabel(repricing.status)}
            </Badge>
            <span className="text-fg-muted text-sm">{ruleSentence(repricing)}</span>
            {repricing.comment ? (
              <span className="text-fg-subtle text-sm">· {repricing.comment}</span>
            ) : null}
          </div>
        }
      />

      {risky.length > 0 && draft ? (
        <Card className="border-danger-border bg-danger-subtle">
          <CardBody className="flex items-start gap-3 p-4">
            <AlertTriangle className="text-danger mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              {formatNumber(risky.length)}{' '}
              {risky.length === 1 ? 'product would sell' : 'products would sell'} for less than{' '}
              {risky.length === 1 ? 'it' : 'they'} cost. Use the{' '}
              <button
                type="button"
                className="text-fg font-medium underline"
                onClick={() => setLens('risky')}
              >
                Below cost
              </button>{' '}
              filter and fix {risky.length === 1 ? 'it' : 'them'} before applying.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-fg-muted text-sm">Prices changing</p>
          <p className="text-fg mt-0.5 text-lg font-semibold">
            {formatNumber(changed.length)}{' '}
            <span className="text-fg-subtle text-sm">
              of {formatNumber(repricing.lines.length)}
            </span>
          </p>
          <p className="text-fg-subtle text-2xs">
            {formatNumber(raisedCount(repricing))} up · {formatNumber(loweredCount(repricing))} down
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-fg-muted text-sm">Average move</p>
          <p
            className={`mt-0.5 text-lg font-semibold ${
              averageChange(repricing) < 0 ? 'text-danger' : 'text-fg'
            }`}
          >
            {averageChange(repricing) > 0 ? '+' : ''}
            {formatPercent(averageChange(repricing))}
          </p>
          <p className="text-fg-subtle text-2xs">across the prices that change</p>
        </Card>
        {canSeeCost ? (
          <Card className="p-4">
            <p className="text-fg-muted text-sm">Margin</p>
            <p className="text-fg mt-0.5 text-lg font-semibold">
              {formatPercent(shift.before)} <span className="text-fg-subtle text-sm">→</span>{' '}
              <span className={shift.after < shift.before ? 'text-danger' : 'text-success'}>
                {formatPercent(shift.after)}
              </span>
            </p>
            <p className="text-fg-subtle text-2xs">average, against what each part cost</p>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <CardTitle>Prices</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Which prices to show"
              options={[
                { value: null, label: 'All' },
                { value: 'changed', label: 'Changing' },
                { value: 'risky', label: 'Below cost' },
              ]}
              value={lens === 'all' ? null : lens}
              onChange={(next) => setLens((next as Lens) ?? 'all')}
              counts={{
                all: repricing.lines.length,
                changed: changed.length,
                risky: risky.length,
              }}
            />
            <div className="relative w-full max-w-64">
              <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Find by name or SKU…"
                aria-label="Find a product"
                className="h-8 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="px-4 py-2 text-left font-semibold">Product</th>
                  {canSeeCost ? <th className="px-4 py-2 text-right font-semibold">Cost</th> : null}
                  <th className="px-4 py-2 text-right font-semibold">Now</th>
                  <th className="px-4 py-2 text-right font-semibold">New price</th>
                  <th className="px-4 py-2 text-right font-semibold">Change</th>
                  {canSeeCost ? (
                    <th className="px-4 py-2 text-right font-semibold">Margin</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-fg-subtle px-4 py-6 text-center text-sm">
                      {lens === 'risky'
                        ? 'No product would sell below what it cost.'
                        : lens === 'changed'
                          ? 'No price is changing.'
                          : 'Nothing matches that search.'}
                    </td>
                  </tr>
                ) : null}
                {visible.map((line) => {
                  const change = lineChange(line)
                  const below = line.costAtTime > 0 && line.newPrice < line.costAtTime
                  const newMargin = marginOf(line.newPrice, line.costAtTime)
                  return (
                    <tr key={line.id} className="border-border border-t">
                      <td className="px-4 py-2">
                        <Link
                          to={paths.products.detail(line.productId)}
                          className="flex items-center gap-2.5 hover:underline"
                        >
                          <ProductThumb src={line.imageUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="text-fg font-medium">{line.name}</p>
                            <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
                          </div>
                        </Link>
                      </td>
                      {canSeeCost ? (
                        <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                          {formatMoney(Math.round(line.costAtTime))}
                        </td>
                      ) : null}
                      <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                        {formatMoney(line.oldPrice)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {draft ? (
                          <NumberField
                            className="w-36"
                            nullable={false}
                            aria-label={`New price for ${line.name}`}
                            aria-invalid={below ? true : undefined}
                            value={line.newPrice}
                            onChange={(next) => actions.setPrice(line.id, next ?? 0)}
                          />
                        ) : (
                          <span className="text-fg px-2 font-medium tabular-nums">
                            {formatMoney(line.newPrice)}
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium tabular-nums ${
                          change === 0
                            ? 'text-fg-subtle'
                            : change < 0
                              ? 'text-danger'
                              : 'text-success'
                        }`}
                      >
                        {change === 0
                          ? 'unchanged'
                          : `${change > 0 ? '+' : '−'}${formatPercent(
                              Math.abs(change) / (line.oldPrice || 1),
                            )}`}
                      </td>
                      {canSeeCost ? (
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            below ? 'text-danger font-medium' : 'text-fg-muted'
                          }`}
                        >
                          {below ? 'below cost' : formatPercent(newMargin)}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {repricing.status !== 'draft' ? (
        <Card>
          <CardBody className="flex items-start gap-3 p-4">
            <Check className="text-fg-muted mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              {repricing.status === 'applied'
                ? `Applied on ${formatDateTime(repricing.appliedAt!)}. Putting the prices back restores exactly what each one was — not the rule in reverse, which rounding would drift away from.`
                : `Reverted on ${formatDateTime(repricing.revertedAt!)}. Every price went back to what it was before ${repricing.number}.`}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        title="Apply these prices?"
        confirmLabel="Apply"
        destructive={risky.length > 0}
        body={
          <>
            {formatNumber(changed.length)} products change price:{' '}
            {formatNumber(raisedCount(repricing))} up, {formatNumber(loweredCount(repricing))} down,{' '}
            {averageChange(repricing) > 0 ? '+' : ''}
            {formatPercent(averageChange(repricing))} on average.
            {risky.length > 0 ? (
              <>
                {' '}
                <strong className="text-danger font-medium">
                  {formatNumber(risky.length)} would sell below cost.
                </strong>
              </>
            ) : null}{' '}
            It can be put back afterwards.
          </>
        }
        onConfirm={() =>
          actions.apply({
            onSuccess: () => {
              setConfirmApply(false)
              toast.success(`${repricing.number} applied`)
            },
            onError: (message) => toast.error(message),
          })
        }
      />

      <ConfirmDialog
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        title="Put these prices back?"
        confirmLabel="Put back"
        body={`Every one of the ${formatNumber(
          changed.length,
        )} products ${repricing.number} changed goes back to exactly the price it had before.`}
        onConfirm={() =>
          actions.revert({
            onSuccess: () => {
              toast.success(`${repricing.number} reverted`)
              setConfirmRevert(false)
              navigate(paths.products.repricing)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}

/** The rule as a sentence, because "percent 8 1000" is not readable. */
export function ruleSentence(repricing: {
  rule: { kind: string; value: number; roundTo: number }
}) {
  const { kind, value, roundTo } = repricing.rule
  const rounding = roundTo > 1 ? `, rounded to ${formatNumber(roundTo)}` : ''
  if (kind === 'percent') return `${value > 0 ? '+' : ''}${value}%${rounding}`
  if (kind === 'amount') return `${value > 0 ? '+' : ''}${formatMoney(value)}${rounding}`
  if (kind === 'margin') return `${formatPercent(value)} margin on cost${rounding}`
  return 'Typed by hand'
}
