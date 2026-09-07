import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, Check, Search, X } from 'lucide-react'
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
import { USD_RATE } from '@/data/seed'
import { useStocktake, useStocktakeActions } from '../api/stocktakes'
import {
  accuracy,
  canCount,
  discrepancies,
  lineVariance,
  netCostValue,
  netUnits,
  progress,
  shortUnits,
  stocktakeStatusLabel,
  stocktakeStatusTone,
  surplusUnits,
} from '../model/stocktake'

type Lens = 'all' | 'uncounted' | 'differs'

/**
 * The counting sheet. Unlike every other detail page in the app this one is
 * *worked in* rather than read — someone stands in the aisle with it open and
 * types what they can see.
 *
 * Which is why the lenses matter more than they look. "Left to count" is how a
 * person finishes; "Differs" is how a manager reviews before committing. And an
 * uncounted line is drawn as blank, never as zero, because the difference
 * between "nobody got there" and "there are none" is the entire reason this
 * screen exists rather than a large correction.
 */
export default function StocktakeDetailPage() {
  const navigate = useNavigate()
  const { stocktakeId } = useParams()
  const { can } = useSession()
  const { data: stocktake } = useStocktake(stocktakeId ?? '')
  const actions = useStocktakeActions(stocktakeId ?? '')
  const [lens, setLens] = useState<Lens>('all')
  const [term, setTerm] = useState('')
  const [confirmApply, setConfirmApply] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const visible = useMemo(() => {
    if (!stocktake) return []
    return stocktake.lines.filter((line) => {
      if (lens === 'uncounted' && line.counted !== null) return false
      if (lens === 'differs') {
        const variance = lineVariance(line)
        if (variance === null || variance === 0) return false
      }
      return matches([line.name, line.sku, line.shelfAddress, line.categoryName], term)
    })
  }, [stocktake, lens, term])

  if (!stocktake) {
    return <EmptyState title="Stocktake not found" description="It may have been deleted." />
  }

  const open = canCount(stocktake.status)
  const { done, total, ratio } = progress(stocktake)
  const differing = discrepancies(stocktake)
  const short = shortUnits(stocktake)
  const surplus = surplusUnits(stocktake)
  const value = netCostValue(stocktake, USD_RATE)
  const canSeeCost = can('products.cost.view')

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.stocktaking}>
          <ArrowLeft />
          Stocktaking
        </Link>
      </Button>

      <PageHeader
        title={stocktake.number}
        description={`${formatNumber(total)} lines at ${stocktake.locationName}${
          stocktake.categoryName ? ` · ${stocktake.categoryName} only` : ''
        }`}
        action={
          <div className="flex items-center gap-2">
            {open && can('products.stocktaking.delete') ? (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                <Ban />
                Abandon
              </Button>
            ) : null}
            {open && can('products.stocktaking.edit') ? (
              <Button
                variant="primary"
                disabled={differing.length === 0}
                title={
                  differing.length === 0 ? 'Nothing counted differs from the system yet' : undefined
                }
                onClick={() => setConfirmApply(true)}
              >
                <Check />
                Apply {formatNumber(differing.length)} changes
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={stocktakeStatusTone(stocktake.status)}>
              {stocktakeStatusLabel(stocktake.status)}
            </Badge>
            <span className="text-fg-muted text-sm">{stocktake.locationName}</span>
            {stocktake.comment ? (
              <span className="text-fg-subtle text-sm">· {stocktake.comment}</span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-fg-muted text-sm">Counted</p>
          <p className="text-fg mt-0.5 text-lg font-semibold">
            {formatNumber(done)}{' '}
            <span className="text-fg-subtle text-sm">of {formatNumber(total)}</span>
          </p>
          <span className="bg-surface-inset mt-2 block h-1.5 overflow-hidden rounded-full">
            <span
              className={`block h-full rounded-full ${ratio >= 1 ? 'bg-success' : 'bg-info'}`}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </span>
        </Card>
        <Card className="p-4">
          <p className="text-fg-muted text-sm">System was right</p>
          <p className="text-fg mt-0.5 text-lg font-semibold">
            {formatPercent(accuracy(stocktake))}
          </p>
          <p className="text-fg-subtle text-2xs">
            {formatNumber(differing.length)} of {formatNumber(done)} counted lines differ
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-fg-muted text-sm">Missing / found</p>
          <p
            className={`mt-0.5 text-lg font-semibold ${
              netUnits(stocktake) < 0 ? 'text-danger' : 'text-fg'
            }`}
          >
            {short > 0 ? `−${formatNumber(short)}` : '0'}
            {surplus > 0 ? ` / +${formatNumber(surplus)}` : ''}
          </p>
          <p className="text-fg-subtle text-2xs">
            {canSeeCost
              ? `${value < 0 ? '−' : ''}${formatMoney(Math.abs(value))} at cost`
              : 'units missing / found'}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <CardTitle>Counting sheet</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              ariaLabel="Which lines to show"
              options={[
                { value: null, label: 'All' },
                { value: 'uncounted', label: 'Left to count' },
                { value: 'differs', label: 'Differs' },
              ]}
              value={lens === 'all' ? null : lens}
              onChange={(next) => setLens((next as Lens) ?? 'all')}
              counts={{
                all: stocktake.lines.length,
                uncounted: total - done,
                differs: differing.length,
              }}
            />
            <div className="relative w-full max-w-64">
              <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Find by name, SKU or shelf…"
                aria-label="Find a line"
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
                  <th className="px-4 py-2 text-left font-semibold">Shelf</th>
                  <th className="px-4 py-2 text-right font-semibold">System says</th>
                  <th className="px-4 py-2 text-right font-semibold">Counted</th>
                  <th className="px-4 py-2 text-right font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-fg-subtle px-4 py-6 text-center text-sm">
                      {lens === 'uncounted'
                        ? 'Every line has been counted.'
                        : lens === 'differs'
                          ? 'Nothing counted so far disagrees with the system.'
                          : 'No lines match that search.'}
                    </td>
                  </tr>
                ) : null}
                {visible.map((line) => {
                  const variance = lineVariance(line)
                  return (
                    <tr key={line.id} className="border-border border-t">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb src={line.imageUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="text-fg font-medium">{line.name}</p>
                            <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-fg-muted text-2xs px-4 py-2 font-mono">
                        {line.shelfAddress ?? '—'}
                      </td>
                      <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                        {formatNumber(line.expected)} {line.unit}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <NumberField
                            className="w-24"
                            /* Blank means uncounted, and stays blank — the one
                               place in the app where an empty number field is
                               load-bearing rather than a nuisance. */
                            value={line.counted}
                            disabled={!open}
                            placeholder="—"
                            aria-label={`Counted ${line.name}`}
                            onChange={(next) => actions.setCount(line.id, next)}
                          />
                          {open && line.counted !== null ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Clear the count for ${line.name}`}
                              title="Not counted yet"
                              onClick={() => actions.setCount(line.id, null)}
                            >
                              <X />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium tabular-nums ${
                          variance === null
                            ? 'text-fg-subtle'
                            : variance === 0
                              ? 'text-fg-subtle'
                              : variance < 0
                                ? 'text-danger'
                                : 'text-success'
                        }`}
                      >
                        {variance === null
                          ? 'not counted'
                          : variance === 0
                            ? 'agrees'
                            : `${variance > 0 ? '+' : '−'}${formatNumber(Math.abs(variance))}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {stocktake.status === 'applied' ? (
        <Card>
          <CardBody className="flex items-start gap-3 p-4">
            <Check className="text-success mt-0.5 size-4 shrink-0" />
            <p className="text-fg-muted text-sm">
              Applied on {formatDateTime(stocktake.appliedAt!)}. The differences were committed as a
              correction, so they sit in the same ledger as every other adjustment
              {stocktake.correctionId ? (
                <>
                  {' — '}
                  <Link
                    className="text-fg font-medium underline"
                    to={paths.products.correctionDetail(stocktake.correctionId)}
                  >
                    see it
                  </Link>
                </>
              ) : null}
              . Reversing that correction undoes this count.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        title="Apply this count?"
        confirmLabel="Apply"
        destructive={false}
        body={
          <>
            {formatNumber(differing.length)} counted lines differ from the system:{' '}
            {short > 0 ? `${formatNumber(short)} missing` : 'none missing'}
            {surplus > 0 ? `, ${formatNumber(surplus)} found` : ''}
            {canSeeCost ? `, ${value < 0 ? '−' : ''}${formatMoney(Math.abs(value))} at cost` : ''}.
            {total - done > 0 ? (
              <>
                {' '}
                <strong className="text-fg font-medium">
                  {formatNumber(total - done)} lines have not been counted
                </strong>{' '}
                and will be left exactly as they are — nothing is written off for them.
              </>
            ) : null}
          </>
        }
        onConfirm={() =>
          actions.apply({
            onSuccess: () => {
              setConfirmApply(false)
              toast.success(`${stocktake.number} applied`)
            },
            onError: (message) => toast.error(message),
          })
        }
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Abandon this count?"
        confirmLabel="Abandon"
        body={`Everything counted so far on ${stocktake.number} is discarded and no stock changes. The count would have to be started again.`}
        onConfirm={() =>
          actions.cancel({
            onSuccess: () => {
              toast.success(`${stocktake.number} abandoned`)
              setConfirmCancel(false)
              navigate(paths.products.stocktaking)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}
