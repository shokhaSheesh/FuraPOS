import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ReceiptText,
  Banknote,
  ChevronDown,
  Clock,
  ArrowRightLeft,
  HandCoins,
  Percent,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Popover } from '@/shared/ui/Popover'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { demandAt } from '@/shared/lib/demand'
import { paths } from '@/shared/config/paths'
import { t, tn } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import type { VariationRow } from '@/features/products/model/product'
import {
  computeTotals,
  lineTotal,
  type Sale,
  type PaymentMethod,
  type SaleLine,
  type SaleStatus,
} from '@/features/sales/model/sale'
import { useOpenShiftAt } from '@/features/cashShifts/api/shifts'
import { cashSaleBlocked } from '@/features/cashShifts/model/shift'
import { useBestPromotion } from '@/features/promotions/api/promotions'
import { covers, describe as describePromotion } from '@/features/promotions/model/promotion'
import { addOne, quantityIn, setQuantity, unitsIn } from '../model/cart'
import { TillCatalogue, type TillRow } from '../components/TillCatalogue'
import { TillCatalogueSidebar, browseTitle } from '../components/TillCatalogueSidebar'
import { TillCustomer } from '../components/TillCustomer'
import { TillFilters } from '../components/TillFilters'
import { WALK_IN, needsTruck, type TillBuyer } from '../model/buyer'
import { useActiveTab, useTillStore } from '../model/tillStore'
import { SaleTabs } from '../components/SaleTabs'
import { PrintSale, type SaleDocument } from '../components/SaleDocuments'

const PAYMENTS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  // Paid by transfer from a card or a phone app — «Перевод» (client request).
  { value: 'card', label: 'Card transfer', icon: ArrowRightLeft },
  { value: 'credit', label: 'On credit', icon: HandCoins },
]

/**
 * The till (client request): a screen of its own, opened from the sidebar,
 * where a sale is rung up rather than filled in.
 *
 * It replaces the New sale form. The shelf is on the left, browsed the way
 * every document in the product picks parts — categories, make and model,
 * cards — and the cart is on the right with everything that finishes a sale:
 * who is buying, the promotion that applies, how they pay and the change.
 * Nothing on the till is new to the sale itself; it writes exactly the sale
 * the form did, so the ledger, cash-up, promotions report and debts read it
 * the same way.
 */
export default function PosPage() {
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const createSale = useDataStore((s) => s.createSale)

  // The session — shop, open sales, catalogue — outlives a step to another tab.
  const locationId = useTillStore((state) => state.locationId) ?? ''
  const tab = useActiveTab()
  const update = useTillStore((state) => state.update)
  const setCart = useTillStore((state) => state.setCart)
  const last = useTillStore((state) => state.last)
  const finish = useTillStore((state) => state.finish)
  const browse = useTillStore((state) => state.browse)
  const setBrowse = useTillStore((state) => state.setBrowse)
  const catalogueOpen = useTillStore((state) => state.catalogueOpen)
  const toggleCatalogue = useTillStore((state) => state.toggleCatalogue)
  const rewriteSale = useDataStore((s) => s.rewriteSale)
  const categories = useDataStore((s) => s.categorySettings)
  const location = locations.find((l) => l.id === locationId)
  const { cart, buyer, payment, paidText, channel, comment } = tab
  const appliedPromotionId = tab.promotionId
  const setBuyer = (next: TillBuyer) => update({ buyer: next })
  const setPayment = (next: PaymentMethod) => update({ payment: next })
  const setPaidText = (next: string) => update({ paidText: next })
  const setAppliedPromotionId = (next: string | null) => update({ promotionId: next })
  const setComment = (next: string) => update({ comment: next })
  /** Everything a counter sale rarely needs, folded away until it does. */
  const [more, setMore] = useState(false)
  /** The sale just paid for, while the cashier chooses what to print. */
  const [paidSale, setPaidSale] = useState<Sale | null>(null)
  const [printing, setPrinting] = useState<SaleDocument | null>(null)
  const donePrinting = useCallback(() => setPrinting(null), [])

  const openShift = useOpenShiftAt(locationId)
  const noDrawer = cashSaleBlocked(payment, openShift !== null)

  const stockHere = useCallback(
    (variation: VariationRow) =>
      variation.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0,
    [locationId],
  )

  /** The shop's shelf: what it holds now, best sellers here first. */
  const rows = useMemo<TillRow[]>(
    () =>
      variations
        .filter((variation) => variation.status === 'active' && stockHere(variation) > 0)
        .map((variation) => ({
          key: variation.id,
          variation,
          here: stockHere(variation),
          quantity: quantityIn(cart, variation.id),
          demand: demandAt(sales, variation.id, locationId),
        })),
    [variations, stockHere, cart, sales, locationId],
  )

  const add = (variation: VariationRow) => {
    const available = stockHere(variation)
    if (quantityIn(cart, variation.id) >= available) {
      toast.error(
        t('Only {count} at {locationName}', { count: available, locationName: location?.name }),
      )
      return
    }
    setCart((current) => addOne(current, variation, available))
  }

  const setUnits = (variationId: string, quantity: number) => {
    const variation = variations.find((v) => v.id === variationId)
    if (!variation) return
    setCart((current) => setQuantity(current, variation, quantity, stockHere(variation)))
  }

  /* --- promotions --------------------------------------------------------- */

  const promotable = useMemo(
    () =>
      cart.map((line) => ({
        variationId: line.variationId,
        productId: line.productId,
        categoryId: variations.find((v) => v.id === line.variationId)?.categoryId ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    [cart, variations],
  )
  const offer = useBestPromotion(promotable, {
    clientId: buyer.client?.id ?? null,
    driverId: buyer.driver?.id ?? null,
  })
  const discounted = cart.some((line) => line.discountPercent > 0)

  /** The offer as a percentage on the lines it covers — exact for a fixed amount too. */
  const applyOffer = () => {
    if (!offer) return
    const covered = promotable.filter((line) => covers(offer.promotion, line))
    const value = covered.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    if (value <= 0) return
    const percent = Math.round((offer.discount / value) * 10_000) / 100
    const ids = new Set(covered.map((line) => line.variationId))
    setCart((current) =>
      current.map((line) =>
        ids.has(line.variationId) ? { ...line, discountPercent: percent } : line,
      ),
    )
    setAppliedPromotionId(offer.promotion.id)
    toast.success(t('{name} applied', { name: offer.promotion.name }))
  }

  /* --- paying ------------------------------------------------------------- */

  const totals = computeTotals(cart, Number(paidText) || 0)
  const units = unitsIn(cart)
  /** Credit is a debt on somebody's account, so it needs somebody. */
  const creditWithoutAccount = payment === 'credit' && buyer.client === null
  // The two rules Settings can switch (client request).
  const company = useDataStore((s) => s.company)
  const clientMissing = !company.allowSaleWithoutClient && buyer.party === null
  const zeroBlocked = !company.allowZeroSale && cart.length > 0 && totals.total <= 0

  /** Step 1 is done: something to sell, and whose purchase it is. */
  const readyToPay = cart.length > 0 && !needsTruck(buyer) && !clientMissing
  const blocked = !readyToPay || noDrawer || creditWithoutAccount || zeroBlocked

  /*
    A discount given at the counter (client request) — haggling is normal in
    this trade. It is spread across the lines as a percentage, exactly as an
    applied promotion is, so a sale carries one kind of discount and every
    report reads it the same way.
  */
  const setDiscount = (percent: number) => {
    const safe = Math.max(0, Math.min(100, Math.round(percent * 100) / 100))
    setCart((current) => current.map((line) => ({ ...line, discountPercent: safe })))
    if (safe === 0) setAppliedPromotionId(null)
  }

  const totalsBlock = (
    <div className="space-y-1 text-sm">
      <Row label={`${t('Subtotal')} · ${formatNumber(units)} ${tn(units, 'unit', 'units')}`}>
        {formatMoney(totals.subtotal)}
      </Row>
      <div className="flex items-baseline justify-between">
        <span className="text-fg-muted">{t('Discount')}</span>
        <DiscountControl
          gross={totals.subtotal}
          discount={totals.discount}
          disabled={cart.length === 0}
          onApply={setDiscount}
        />
      </div>
      <div className="flex items-baseline justify-between pt-1">
        <span className="text-fg font-medium">{t('To pay')}</span>
        <span className="text-fg text-2xl font-semibold tabular-nums">
          {formatMoney(totals.total)}
        </span>
      </div>
    </div>
  )

  /** Empties the sale on screen, leaving the other open sales alone. */
  const reset = () =>
    update({
      cart: [],
      buyer: WALK_IN,
      payment: 'cash',
      paidText: '',
      promotionId: null,
      channel: 'desk',
      comment: '',
      step: 'sale',
    })

  /** The sale on screen as the store takes it, in a given state. */
  const operator = useTillStore((state) => state.operator)
  const saleInput = (status: SaleStatus, paid: number) => ({
    // Whoever is signed in at the till rang it up.
    sellerId: operator?.id ?? null,
    clientId: buyer.client?.id ?? null,
    driverId: buyer.driver?.id ?? null,
    truckPlate: buyer.truck?.truck.plate ?? null,
    locationId,
    paymentMethod: payment,
    channel,
    comment,
    paid,
    lines: cart,
    promotionId: appliedPromotionId,
    expiresAt: null,
    status,
  })

  /** Writes the sale — over the parked one it carries on with, when there is one. */
  const save = (status: SaleStatus, paid: number) => {
    const input = saleInput(status, paid)
    return tab.parked ? rewriteSale(tab.parked.id, input) : createSale(input)
  }

  const pay = () => {
    // On credit nothing changes hands; otherwise an empty field means paid in full.
    const sale = save('completed', payment !== 'credit' ? Number(paidText) || totals.total : 0)
    if (!sale) return
    finish({ id: sale.id, number: sale.number })
    // Then the paper, if any (client request): the receipt, or the waybill.
    setPaidSale(sale)
  }

  /*
    Parking (client request): the customer steps out for ten minutes, the sale
    waits in «Отложки» exactly as it was, and the till is free for the next
    person. It is a sale in the «Отложено» state, so the back office sees it
    too; picking it up and paying finishes that same sale.
  */
  const park = () => {
    const sale = save('postponed', 0)
    if (!sale) return
    toast.success(t('{number} parked — pick it up from «Отложки»', { number: sale.number }))
    finish(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'grid min-h-0 flex-1',
          catalogueOpen
            ? 'grid-cols-[17rem_minmax(0,1fr)_25rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_30rem]'
            : 'grid-cols-[3.5rem_minmax(0,1fr)_25rem] 2xl:grid-cols-[3.5rem_minmax(0,1fr)_30rem]',
        )}
      >
        <TillCatalogueSidebar
          rows={rows}
          value={browse}
          onChange={setBrowse}
          open={catalogueOpen}
          onToggle={toggleCatalogue}
        />
        <main className="min-h-0 overflow-y-auto p-4">
          <TillCatalogue
            rows={rows}
            locationName={location?.name ?? ''}
            browse={{ ...browse, title: browseTitle(browse, categories) }}
            tools={<TillFilters rows={rows} value={browse} onChange={setBrowse} />}
            onAdd={(row) => add(row.variation)}
            onSet={(changes) =>
              changes.forEach(({ row, quantity }) => setUnits(row.variation.id, quantity))
            }
          />
        </main>

        <aside className="border-border bg-surface flex min-h-0 flex-col border-l">
          <div className="border-border space-y-3 border-b p-3">
            <SaleTabs />
            {tab.parked ? (
              <p className="bg-warning-soft text-warning rounded-control px-2.5 py-1.5 text-xs font-medium">
                {t('Carrying on with parked sale {number}', { number: tab.parked.number })}
              </p>
            ) : null}
            <StepBar step={tab.step} canPay={readyToPay} onStep={(step) => update({ step })} />
            {tab.step === 'sale' ? (
              <>
                <ProductPicker onPick={add} placeholder={t('Scan a barcode or search to add…')} />
                <TillCustomer key={tab.id} buyer={buyer} onChange={setBuyer} />
              </>
            ) : null}
          </div>

          {tab.step === 'sale' ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="text-fg-subtle flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <ShoppingCart className="size-8" />
                    <p className="text-fg text-sm font-medium">{t('The cart is empty')}</p>
                    <p className="text-2xs max-w-60">
                      {t('Tap a product on the left, or scan its barcode.')}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-border divide-y">
                    {cart.map((line) => (
                      <CartLine
                        key={line.id}
                        line={line}
                        variation={variations.find((v) => v.id === line.variationId)}
                        onQuantity={(quantity) => setUnits(line.variationId, quantity)}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-border space-y-3 border-t p-3">
                {offer && !discounted ? (
                  <div className="border-primary-border bg-primary-soft/40 rounded-control flex items-start gap-2 border p-2.5">
                    <Tag className="text-primary mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-fg text-sm font-medium">{offer.promotion.name}</p>
                      <p className="text-fg-muted text-2xs">
                        {describePromotion(offer.promotion)} {t('— takes')}{' '}
                        {formatMoney(offer.discount)} {t('off this sale.')}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={applyOffer}>
                      {t('Apply it')}
                    </Button>
                  </div>
                ) : null}

                {totalsBlock}

                <div>
                  <button
                    type="button"
                    onClick={() => setMore((open) => !open)}
                    className="text-fg-muted hover:text-fg flex items-center gap-1 text-xs"
                    aria-expanded={more}
                  >
                    <ChevronDown
                      className={cn('size-3.5 transition-transform', more && 'rotate-180')}
                    />
                    {t('Comment')}
                  </button>
                  {/* No source picker (client request): a till sale is a counter sale. */}
                  {more ? (
                    <Input
                      className="mt-2"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder={t('Comment')}
                      aria-label={t('Comment')}
                    />
                  ) : null}
                </div>

                {clientMissing && cart.length > 0 ? (
                  <p className="text-danger text-2xs">
                    {t('Choose the driver — a sale without a client is switched off in Settings.')}
                  </p>
                ) : null}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={park}
                    title={t('Put this sale aside and serve the next customer')}
                  >
                    <Clock />
                    {t('Park')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={!readyToPay}
                    onClick={() => update({ step: 'payment' })}
                  >
                    {t('To payment')}
                    <ArrowRight />
                  </Button>
                </div>
                {last && cart.length === 0 ? (
                  <p className="text-fg-subtle text-center text-xs">
                    {t('Last sale')}{' '}
                    <Link
                      to={paths.sales.orderDetail(last.id)}
                      className="text-primary font-mono hover:underline"
                    >
                      {last.number}
                    </Link>
                  </p>
                ) : null}
                {cart.length > 0 ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-fg-subtle hover:text-danger mx-auto flex items-center gap-1 text-xs"
                  >
                    <X className="size-3.5" />
                    {t('Clear the sale')}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {/* What is being paid for, read back before the money changes hands. */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                <div className="border-border rounded-card border p-2.5">
                  <p className="text-fg-subtle text-2xs">{t('Customer')}</p>
                  <p className="text-fg text-sm font-medium">
                    {buyer.driver?.fullName ?? buyer.client?.name ?? t('Walk-in customer')}
                  </p>
                  {buyer.truck || (buyer.client && buyer.driver) ? (
                    <p className="text-fg-muted text-2xs">
                      {[buyer.truck?.truck.plate, buyer.driver ? buyer.client?.name : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
                <ul className="divide-border border-border rounded-card divide-y border">
                  {cart.map((line) => (
                    <li key={line.id} className="flex items-baseline gap-2 px-2.5 py-2 text-sm">
                      <span className="text-fg min-w-0 flex-1 truncate" title={line.name}>
                        {line.name}
                      </span>
                      <span className="text-fg-muted shrink-0 tabular-nums">
                        {formatNumber(line.quantity)} {t(line.unit)}
                      </span>
                      <span className="text-fg w-28 shrink-0 text-right font-medium tabular-nums">
                        {formatMoney(Math.round(lineTotal(line)))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-border space-y-3 border-t p-3">
                {totalsBlock}

                <div
                  className="grid grid-cols-3 gap-1.5"
                  role="radiogroup"
                  aria-label={t('Payment method')}
                >
                  {PAYMENTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={payment === option.value}
                      onClick={() => setPayment(option.value)}
                      className={cn(
                        'rounded-control flex flex-col items-center gap-1 border px-1 py-2.5 text-sm transition-colors',
                        payment === option.value
                          ? 'border-primary bg-primary-soft text-primary font-medium'
                          : 'border-border text-fg-muted hover:border-border-strong',
                      )}
                    >
                      <option.icon className="size-5" />
                      <span className="truncate">{t(option.label)}</span>
                    </button>
                  ))}
                </div>
                {noDrawer ? (
                  <p className="text-danger text-2xs">
                    {t(
                      'No cash drawer is open at this location — open a shift, or take payment another way',
                    )}
                  </p>
                ) : null}
                {zeroBlocked ? (
                  <p className="text-danger text-2xs">
                    {t('A sale for 0 UZS is switched off in Settings.')}
                  </p>
                ) : null}
                {creditWithoutAccount ? (
                  <p className="text-danger text-2xs">
                    {t('On credit needs a client — find one above, or take payment another way.')}
                  </p>
                ) : null}

                {payment !== 'credit' ? (
                  <label className="block space-y-1">
                    <span className="text-fg-muted text-2xs flex items-center justify-between">
                      {t('Received')}
                      <button
                        type="button"
                        onClick={() => setPaidText(String(Math.round(totals.total)))}
                        className="text-primary hover:underline"
                      >
                        {t('Exact amount')}
                      </button>
                    </span>
                    {/* Grouped as it is typed — «200 000», never «200000». */}
                    <Input
                      inputMode="numeric"
                      value={paidText === '' ? '' : formatNumber(Number(paidText))}
                      onChange={(event) => setPaidText(event.target.value.replace(/\D/g, ''))}
                      placeholder={formatNumber(Math.round(totals.total))}
                      aria-label={t('Amount paid')}
                      className="h-11 text-right text-base"
                    />
                    {/* Less than the total is left owing, more is change back. */}
                    {paidText !== '' && totals.debt > 0 ? (
                      <span className="text-danger text-2xs block text-right">
                        {t('Remaining debt')}: {formatMoney(totals.debt)}
                      </span>
                    ) : paidText !== '' && totals.change > 0 ? (
                      <span className="text-fg-muted text-2xs block text-right">
                        {t('Change due')}: {formatMoney(totals.change)}
                      </span>
                    ) : null}
                  </label>
                ) : null}

                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => update({ step: 'sale' })}
                  >
                    <ArrowLeft />
                    {t('Back')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={blocked}
                    onClick={pay}
                  >
                    {t('Pay {total}', { total: formatMoney(totals.total) })}
                  </Button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <Modal
        open={paidSale !== null}
        onOpenChange={(open) => (open ? undefined : setPaidSale(null))}
        title={t('{number} paid', { number: paidSale?.number ?? '' })}
        description={paidSale ? formatMoney(Math.round(paidSale.total)) : undefined}
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setPaidSale(null)}>
              {t('No receipt')}
            </Button>
          </div>
        }
      >
        <p className="text-fg-muted mb-3 text-sm">{t('What should be printed?')}</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { kind: 'receipt', label: t('Print the receipt'), icon: <ReceiptText /> },
              { kind: 'waybill', label: t('Waybill'), icon: <FileText /> },
            ] as const
          ).map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => setPrinting(option.kind)}
              className="border-border hover:border-primary hover:bg-primary-soft/40 rounded-card text-fg [&_svg]:text-primary flex flex-col items-center gap-2 border px-3 py-5 text-sm font-medium transition-colors [&_svg]:size-7"
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </Modal>
      {paidSale && printing ? (
        <PrintSale sale={paidSale} document={printing} onDone={donePrinting} />
      ) : null}
    </div>
  )
}

/**
 * A discount typed at the counter, as a percentage or as a sum off (client
 * request). Both end up as the same per-line percentage, so a sale never
 * carries two kinds of discount that have to be reconciled later.
 */
function DiscountControl({
  gross,
  discount,
  disabled,
  onApply,
}: {
  gross: number
  discount: number
  disabled: boolean
  onApply: (percent: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [text, setText] = useState('')

  const apply = () => {
    const value = Number(text.replace(/\s/g, '').replace(',', '.')) || 0
    onApply(mode === 'percent' ? value : gross > 0 ? (value / gross) * 100 : 0)
    setText('')
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-64 space-y-2 p-3"
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'rounded-control -mr-1 flex items-center gap-1 px-1.5 py-0.5 text-sm transition-colors disabled:opacity-50',
            discount > 0 ? 'text-warning font-medium' : 'text-primary hover:bg-primary-soft/60',
          )}
        >
          <Percent className="size-3.5" />
          {discount > 0 ? `− ${formatMoney(discount)}` : t('Add')}
        </button>
      }
    >
      <SegmentedControl
        aria-label={t('Discount')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'percent', label: '%' },
          { value: 'amount', label: 'UZS' },
        ]}
      />
      <Input
        autoFocus
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply()
        }}
        placeholder={mode === 'percent' ? '10' : formatNumber(Math.round(gross * 0.1))}
        aria-label={t('Discount')}
        className="text-right"
      />
      <div className="flex items-center gap-2">
        {discount > 0 ? (
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => {
              onApply(0)
              setText('')
              setOpen(false)
            }}
          >
            {t('Remove')}
          </Button>
        ) : null}
        <Button type="button" variant="primary" className="flex-1" onClick={apply}>
          {t('Apply')}
        </Button>
      </div>
    </Popover>
  )
}

/** Where the sale on screen is: 1. building it, 2. taking the money. */
function StepBar({
  step,
  canPay,
  onStep,
}: {
  step: 'sale' | 'payment'
  canPay: boolean
  onStep: (step: 'sale' | 'payment') => void
}) {
  const steps = [
    { id: 'sale', label: t('Sale'), enabled: true },
    { id: 'payment', label: t('Payment'), enabled: canPay },
  ] as const
  return (
    <ol className="grid grid-cols-2 gap-1.5">
      {steps.map((entry, index) => {
        const current = step === entry.id
        return (
          <li key={entry.id}>
            <button
              type="button"
              disabled={!entry.enabled}
              aria-current={current ? 'step' : undefined}
              onClick={() => onStep(entry.id)}
              className={cn(
                'rounded-control flex w-full items-center gap-2 border px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-50',
                current
                  ? 'border-primary bg-primary-soft text-primary font-medium'
                  : 'border-border text-fg-muted hover:border-border-strong',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  current ? 'bg-surface text-primary' : 'bg-surface-inset',
                )}
              >
                {index + 1}
              </span>
              {entry.label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** The code alone, as the shop reads it off a box: "SKU-00013-L" → "00013". */
const skuDigits = (sku: string) => sku.match(/\d+/)?.[0] ?? sku

/**
 * One line of the cart, as the client's reference draws it: photo, name, the
 * code and which variation (left, right…) | how many and the line total, with
 * the unit price beneath. No steppers — a tap on the card adds one more; the
 * count is typed over by tapping it, and the bin takes the line out.
 */
function CartLine({
  line,
  variation,
  onQuantity,
}: {
  line: SaleLine
  variation: VariationRow | undefined
  onQuantity: (quantity: number) => void
}) {
  // What is being typed over the count; saved on Enter or leaving the field.
  const [editing, setEditing] = useState<string | null>(null)
  const commit = () => {
    if (editing === null) return
    const next = Number(editing)
    if (editing.trim() !== '' && Number.isFinite(next)) onQuantity(next)
    setEditing(null)
  }
  const net = line.quantity * line.unitPrice * (1 - line.discountPercent / 100)
  const name = variation?.productName ?? line.name
  // A product with one variation has nothing to tell apart.
  const kind = variation && variation.fullName !== variation.productName ? variation.name : null
  return (
    <li className="group flex items-center gap-3 px-3 py-2.5">
      <ProductThumb src={line.imageUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm font-medium" title={line.name}>
          {name}
        </p>
        <p className="text-fg-subtle text-2xs mt-0.5 flex items-center gap-1.5">
          <span className="font-mono">{skuDigits(line.sku)}</span>
          {kind ? (
            <span className="bg-primary-soft text-primary rounded px-1.5 py-px font-medium">
              {kind}
            </span>
          ) : null}
          {line.discountPercent > 0 ? (
            <span className="text-success">−{line.discountPercent}%</span>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-baseline justify-end gap-2">
          {editing !== null ? (
            <Input
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              className="h-7 w-14 px-1 text-center text-sm"
              aria-label={t('Quantity of {label}', { label: line.name })}
              value={editing}
              onChange={(event) => setEditing(event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
                if (event.key === 'Escape') setEditing(null)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(String(line.quantity))}
              title={t('Change the quantity')}
              aria-label={t('Quantity of {label}', { label: line.name })}
              className="text-fg-muted hover:text-fg text-sm whitespace-nowrap tabular-nums hover:underline"
            >
              {formatNumber(line.quantity)} {t(line.unit)}
            </button>
          )}
          <span className="text-fg text-sm font-semibold whitespace-nowrap tabular-nums">
            {formatMoney(Math.round(net))}
          </span>
        </div>
        <p className="text-fg-subtle text-2xs whitespace-nowrap tabular-nums">
          {t('{price} each', { price: formatMoney(line.unitPrice) })}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hover:text-danger size-7 shrink-0 [&_svg]:size-3.5"
        aria-label={t('Remove {label}', { label: line.name })}
        onClick={() => onQuantity(0)}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

function Row({ label, tone, children }: { label: string; tone?: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className={cn('font-medium tabular-nums', tone ?? 'text-fg')}>{children}</span>
    </div>
  )
}
