import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/components/EmptyState'
import { paths } from '@/shared/config/paths'
import { useDataStore } from '@/data/store'

/*
 * Dates and numbers are written by hand here rather than through format.ts.
 * The rest of the app speaks Russian formatting to the people using it; this
 * page is read by a factory in China, so it is in English and uses an
 * unambiguous date — "14 Sep 2026" survives translation where "14.09" does not.
 */
const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
const number = (value: number) => new Intl.NumberFormat('en-US').format(value)
const price = (value: number, currency: string) =>
  `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`

/**
 * The order a factory in China works from.
 *
 * Built as a page rather than a file, and saved to PDF by the browser's own
 * print dialog — the same way print templates reach a printer, with no PDF
 * library to keep up to date. Outside the app shell on purpose: no sidebar, no
 * top bar, just an A4 sheet that prints exactly as it looks.

 */
export default function OrderDocumentPage() {
  const { orderId } = useParams()
  const order = useDataStore((s) => s.orders.find((o) => o.id === orderId))
  const variations = useDataStore((s) => s.variations)
  const company = useDataStore((s) => s.company)

  useEffect(() => {
    if (order) document.title = `${order.number} — Purchase order`
  }, [order])

  if (!order) {
    return <EmptyState title="Order not found" description="It may have been deleted." />
  }

  const rows = [...order.lines].map((line) => ({
    line,
    // The OEM number lives in the product description in this catalogue, and
    // it is the code a factory actually recognises.
    oem: variations.find((v) => v.id === line.variationId)?.oem ?? null,
    brand: variations.find((v) => v.id === line.variationId)?.brandName ?? null,
  }))

  // One currency per document where possible; mixed orders get a total each.
  const totals = new Map<string, number>()
  for (const { line } of rows) {
    totals.set(
      line.costCurrency,
      (totals.get(line.costCurrency) ?? 0) + line.orderedQuantity * line.unitCost,
    )
  }
  const units = rows.reduce((sum, { line }) => sum + line.orderedQuantity, 0)

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0">
      {/* Controls, never printed. */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <Button variant="link" size="sm" className="h-auto px-0 text-neutral-800" asChild>
          <Link to={paths.procurement.orderDetail(order.id)}>
            <ArrowLeft />
            Back to {order.number}
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-neutral-600">
            In the print dialog, choose “Save as PDF”
          </span>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer />
            Save as PDF
          </Button>
        </div>
      </div>

      <article
        className="print-sheet mx-auto min-h-[297mm] w-[210mm] bg-white p-[14mm] text-[11px] leading-snug text-neutral-900 shadow-lg print:shadow-none"
        lang="en"
      >
        <header className="flex items-start justify-between border-b-2 border-neutral-900 pb-4">
          <div>
            <p className="text-lg font-bold tracking-tight">{company.name}</p>
            {company.address ? <p>{company.address}</p> : null}
            <p>{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-wide">PURCHASE ORDER</p>
            <p className="mt-1 font-mono text-sm">{order.number}</p>
            <p>Date: {date(order.sentAt ?? order.createdAt)}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
              Manufacturer / agent
            </p>
            <p className="font-medium">{order.boughtFrom ?? '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
              Deliver to
            </p>
            <p className="font-medium">{order.locationName}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
              Required by
            </p>
            <p className="font-medium">{date(order.expectedAt)}</p>
          </div>
        </section>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-900 text-left text-[9px] tracking-wider uppercase">
              <th className="py-1.5 pr-2">#</th>
              <th className="py-1.5 pr-2">Our code</th>
              <th className="py-1.5 pr-2">OEM no.</th>
              <th className="py-1.5 pr-2">Description</th>
              <th className="py-1.5 pr-2">Brand</th>
              <th className="py-1.5 pr-2 text-right">Qty</th>
              <th className="py-1.5 pr-2 text-right">Unit price</th>
              <th className="py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, oem, brand }, index) => (
              <tr
                key={line.id}
                className="break-inside-avoid border-b border-neutral-300 align-top"
              >
                <td className="py-1.5 pr-2 text-neutral-500">{index + 1}</td>
                <td className="py-1.5 pr-2 font-mono">{line.sku}</td>
                <td className="py-1.5 pr-2 font-mono">{oem ?? '—'}</td>
                <td className="py-1.5 pr-2">{line.name}</td>
                <td className="py-1.5 pr-2">{brand ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {number(line.orderedQuantity)} {line.unit}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {price(line.unitCost, line.costCurrency)}
                </td>
                <td className="py-1.5 text-right font-medium tabular-nums">
                  {price(line.orderedQuantity * line.unitCost, line.costCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-3 flex justify-end">
          <table className="min-w-[70mm]">
            <tbody>
              <tr>
                <td className="py-0.5 pr-4 text-neutral-600">Lines</td>
                <td className="py-0.5 text-right tabular-nums">{number(rows.length)}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 text-neutral-600">Units</td>
                <td className="py-0.5 text-right tabular-nums">{number(units)}</td>
              </tr>
              {[...totals].map(([currency, amount]) => (
                <tr key={currency} className="border-t border-neutral-900">
                  <td className="py-1 pr-4 font-bold">Total {currency}</td>
                  <td className="py-1 text-right font-bold tabular-nums">
                    {price(amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {order.comment ? (
          <section className="mt-5">
            <p className="text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
              Notes
            </p>
            <p>{order.comment}</p>
          </section>
        ) : null}

        <p className="mt-5 text-neutral-600">
          Please confirm quantities, prices and the shipping date in writing before production
          starts.
        </p>

        <footer className="mt-12 grid grid-cols-2 gap-12">
          <div className="border-t border-neutral-900 pt-1">
            <p className="text-neutral-600">Issued by — {company.name}</p>
            <p className="text-neutral-600">{order.createdBy}</p>
          </div>
          <div className="border-t border-neutral-900 pt-1">
            <p className="text-neutral-600">Accepted by — manufacturer</p>
          </div>
        </footer>
      </article>
    </div>
  )
}
