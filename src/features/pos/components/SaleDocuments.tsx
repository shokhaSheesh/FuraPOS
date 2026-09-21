import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { PAYMENT_METHODS, lineTotal, type Sale } from '@/features/sales/model/sale'

export type SaleDocument = 'receipt' | 'waybill'

/**
 * Prints one of a sale's two papers (client request): the till receipt the
 * customer takes, or the waybill — «накладная» — a fleet's driver signs for
 * the goods with. Drawn off screen into `body` and sent to the browser's own
 * print dialog, the way every document in the product reaches a printer; the
 * till stays exactly where it was.
 */
export function PrintSale({
  sale,
  document: kind,
  onDone,
}: {
  sale: Sale
  document: SaleDocument
  onDone: () => void
}) {
  useEffect(() => {
    // After the sheet is in the page, so the dialog prints it and not a blank.
    const timer = window.setTimeout(() => {
      window.print()
      onDone()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return createPortal(
    <div className="print-sheet hidden bg-white text-black print:block">
      {kind === 'receipt' ? <SaleReceipt sale={sale} /> : <SaleWaybill sale={sale} />}
    </div>,
    document.body,
  )
}

const paymentLabel = (sale: Sale) =>
  t(PAYMENT_METHODS.find((method) => method.value === sale.paymentMethod)?.label ?? '')

/** Who took it: the driver and his truck, and whose account it went on. */
const buyerOf = (sale: Sale) =>
  [sale.driverName, sale.truckPlate, sale.clientName].filter(Boolean).join(' · ') ||
  t('Walk-in customer')

/** A narrow till receipt, 80 mm roll wide. */
export function SaleReceipt({ sale }: { sale: Sale }) {
  const company = useDataStore((s) => s.company)
  return (
    <article className="mx-auto w-[72mm] font-mono text-[11px] leading-snug">
      <header className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-sm font-bold">{company.name}</p>
        {company.address ? <p>{company.address}</p> : null}
        {company.phone ? <p>{company.phone}</p> : null}
      </header>
      <section className="border-b border-dashed border-black py-2">
        <p className="text-center font-bold">
          {t('Sales receipt')} {sale.number}
        </p>
        <p>{formatDateTime(sale.finishedAt ?? sale.createdAt)}</p>
        <p>
          {t('Cashier')}: {sale.sellerName}
        </p>
        <p>
          {t('Customer')}: {buyerOf(sale)}
        </p>
      </section>
      <ul className="border-b border-dashed border-black py-2">
        {sale.lines.map((line) => (
          <li key={line.id} className="py-0.5">
            <p>{line.name}</p>
            <p className="flex justify-between">
              <span>
                {formatNumber(line.quantity)} × {formatMoney(line.unitPrice)}
                {line.discountPercent > 0 ? ` −${line.discountPercent}%` : ''}
              </span>
              <span>{formatMoney(Math.round(lineTotal(line)))}</span>
            </p>
          </li>
        ))}
      </ul>
      <section className="space-y-0.5 py-2">
        {sale.discount > 0 ? (
          <p className="flex justify-between">
            <span>{t('Discount')}</span>
            <span>− {formatMoney(Math.round(sale.discount))}</span>
          </p>
        ) : null}
        <p className="flex justify-between text-sm font-bold">
          <span>{t('Total')}</span>
          <span>{formatMoney(Math.round(sale.total))}</span>
        </p>
        <p className="flex justify-between">
          <span>{paymentLabel(sale)}</span>
          <span>{formatMoney(Math.round(sale.paid))}</span>
        </p>
        {sale.debt > 0 ? (
          <p className="flex justify-between">
            <span>{t('Owed')}</span>
            <span>{formatMoney(Math.round(sale.debt))}</span>
          </p>
        ) : null}
      </section>
      <p className="border-t border-dashed border-black pt-2 text-center">
        {t('Thank you for your purchase!')}
      </p>
    </article>
  )
}

/** The waybill: an A4 list of what left the shop, signed by both sides. */
export function SaleWaybill({ sale }: { sale: Sale }) {
  const company = useDataStore((s) => s.company)
  const units = sale.lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <article className="text-[11px] leading-snug">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-base font-bold">{company.name}</p>
          {company.address ? <p>{company.address}</p> : null}
          {company.phone ? <p>{company.phone}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            {t('Waybill')} № {sale.number}
          </p>
          <p>{formatDateTime(sale.finishedAt ?? sale.createdAt)}</p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase">{t('Supplier')}</p>
          <p className="font-medium">
            {company.name}, {sale.locationName}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase">{t('Recipient')}</p>
          <p className="font-medium">{buyerOf(sale)}</p>
        </div>
      </section>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left text-[9px] uppercase">
            <th className="py-1 pr-2">№</th>
            <th className="py-1 pr-2">{t('SKU')}</th>
            <th className="py-1 pr-2">{t('Name')}</th>
            <th className="py-1 pr-2 text-right">{t('Qty')}</th>
            <th className="py-1 pr-2">{t('Unit')}</th>
            <th className="py-1 pr-2 text-right">{t('Price')}</th>
            <th className="py-1 text-right">{t('Amount')}</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line, index) => (
            <tr key={line.id} className="break-inside-avoid border-b border-black/30 align-top">
              <td className="py-1 pr-2">{index + 1}</td>
              <td className="py-1 pr-2 font-mono">{line.sku}</td>
              <td className="py-1 pr-2">{line.name}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(line.quantity)}</td>
              <td className="py-1 pr-2">{t(line.unit)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {formatMoney(line.unitPrice)}
                {line.discountPercent > 0 ? ` −${line.discountPercent}%` : ''}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatMoney(Math.round(lineTotal(line)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-3 flex justify-end">
        <table className="min-w-[70mm]">
          <tbody>
            <tr>
              <td className="py-0.5 pr-4">{t('Units')}</td>
              <td className="py-0.5 text-right tabular-nums">{formatNumber(units)}</td>
            </tr>
            {sale.discount > 0 ? (
              <tr>
                <td className="py-0.5 pr-4">{t('Discount')}</td>
                <td className="py-0.5 text-right tabular-nums">
                  − {formatMoney(Math.round(sale.discount))}
                </td>
              </tr>
            ) : null}
            <tr className="border-t border-black font-bold">
              <td className="py-1 pr-4">{t('Total')}</td>
              <td className="py-1 text-right tabular-nums">
                {formatMoney(Math.round(sale.total))}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-4">{paymentLabel(sale)}</td>
              <td className="py-0.5 text-right tabular-nums">
                {formatMoney(Math.round(sale.paid))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-12 grid grid-cols-2 gap-12">
        <div className="border-t border-black pt-1">
          {t('Released by')}: {sale.sellerName}
        </div>
        <div className="border-t border-black pt-1">{t('Received by')}:</div>
      </footer>
    </article>
  )
}
