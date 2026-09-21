import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Banknote,
  ChevronDown,
  Clock,
  ArrowRightLeft,
  HandCoins,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { NumberField } from '@/shared/components/NumberField'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
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
  SALE_CHANNELS,
  type PaymentMethod,
  type SaleChannel,
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
import { WALK_IN, needsTruck, type TillBuyer } from '../model/buyer'
import { useActiveTab, useTillStore } from '../model/tillStore'
import { SaleTabs } from '../components/SaleTabs'

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
  const rewriteSale = useDataStore((s) => s.rewriteSale)
  const categories = useDataStore((s) => s.categorySettings)
  const location = locations.find((l) => l.id === locationId)
  const { cart, buyer, payment, paidText, channel, comment } = tab
  const appliedPromotionId = tab.promotionId
  const setBuyer = (next: TillBuyer) => update({ buyer: next })
  const setPayment = (next: PaymentMethod) => update({ payment: next })
  const setPaidText = (next: string) => update({ paidText: next })
  const setAppliedPromotionId = (next: string | null) => update({ promotionId: next })
  const setChannel = (next: SaleChannel) => update({ channel: next })
  const setComment = (next: string) => update({ comment: next })
  /** Everything a counter sale rarely needs, folded away until it does. */
  const [more, setMore] = useState(false)

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
  const blocked = cart.length === 0 || noDrawer || needsTruck(buyer) || creditWithoutAccount

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
    })

  /** The sale on screen as the store takes it, in a given state. */
  const saleInput = (status: SaleStatus, paid: number) => ({
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
    toast.success(t('{number} paid', { number: sale.number }))
    finish({ id: sale.id, number: sale.number })
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
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_25rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_30rem]">
        <TillCatalogueSidebar rows={rows} value={browse} onChange={setBrowse} />
        <main className="min-h-0 overflow-y-auto p-4">
          <TillCatalogue
            rows={rows}
            locationName={location?.name ?? ''}
            browse={{ ...browse, title: browseTitle(browse, categories) }}
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
            <ProductPicker onPick={add} placeholder={t('Scan a barcode or search to add…')} />
            <TillCustomer key={tab.id} buyer={buyer} onChange={setBuyer} />
          </div>

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
                    max={stockHere(variations.find((v) => v.id === line.variationId)!)}
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

            <div className="space-y-1 text-sm">
              <Row
                label={`${t('Subtotal')} · ${formatNumber(units)} ${tn(units, 'unit', 'units')}`}
              >
                {formatMoney(totals.subtotal)}
              </Row>
              {totals.discount > 0 ? (
                <Row label={t('Discount')} tone="text-warning">
                  − {formatMoney(totals.discount)}
                </Row>
              ) : null}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-fg font-medium">{t('To pay')}</span>
                <span className="text-fg text-2xl font-semibold tabular-nums">
                  {formatMoney(totals.total)}
                </span>
              </div>
            </div>

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
                    'rounded-control flex flex-col items-center gap-1 border px-1 py-2 text-xs transition-colors',
                    payment === option.value
                      ? 'border-primary bg-primary-soft text-primary font-medium'
                      : 'border-border text-fg-muted hover:border-border-strong',
                  )}
                >
                  <option.icon className="size-4" />
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

            {creditWithoutAccount ? (
              <p className="text-danger text-2xs">
                {t('On credit needs a client — find one above, or take payment another way.')}
              </p>
            ) : null}

            {payment !== 'credit' ? (
              <div className="grid grid-cols-2 items-end gap-2">
                <label className="space-y-1">
                  <span className="text-fg-muted text-2xs">{t('Received')}</span>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={paidText}
                    onChange={(event) => setPaidText(event.target.value)}
                    placeholder={String(Math.round(totals.total))}
                    aria-label={t('Amount paid')}
                    className="text-right"
                  />
                </label>
                {/* Less than the total leaves a debt; more is change — which only cash gives. */}
                {paidText !== '' && totals.debt > 0 ? (
                  <div className="rounded-control bg-danger-soft px-3 py-1.5 text-right">
                    <p className="text-danger text-2xs">{t('Remaining debt')}</p>
                    <p className="text-danger font-semibold tabular-nums">
                      {formatMoney(totals.debt)}
                    </p>
                  </div>
                ) : payment === 'cash' ? (
                  <div className="rounded-control bg-surface-muted px-3 py-1.5 text-right">
                    <p className="text-fg-subtle text-2xs">{t('Change due')}</p>
                    <p className="text-success font-semibold tabular-nums">
                      {formatMoney(totals.change)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-control bg-surface-muted px-3 py-1.5 text-right">
                    <p className="text-fg-subtle text-2xs">{t('Remaining debt')}</p>
                    <p className="text-fg font-semibold tabular-nums">{formatMoney(0)}</p>
                  </div>
                )}
              </div>
            ) : null}

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
                {t('Source and comment')}
              </button>
              {more ? (
                <div className="mt-2 space-y-2">
                  <Select
                    className="w-full"
                    aria-label={t('Source')}
                    value={channel}
                    onChange={setChannel}
                    options={SALE_CHANNELS.map((c) => ({ ...c, label: t(c.label) }))}
                  />
                  <Input
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={t('Comment')}
                  />
                </div>
              ) : null}
            </div>

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
              <Button type="button" variant="primary" size="lg" disabled={blocked} onClick={pay}>
                {t('Pay {total}', { total: formatMoney(totals.total) })}
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
        </aside>
      </div>
    </div>
  )
}

function CartLine({
  line,
  max,
  onQuantity,
}: {
  line: SaleLine
  max: number
  onQuantity: (quantity: number) => void
}) {
  const gross = line.quantity * line.unitPrice
  const net = gross * (1 - line.discountPercent / 100)
  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      <ProductThumb src={line.imageUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm font-medium" title={line.name}>
          {line.name}
        </p>
        <p className="text-fg-subtle text-2xs font-mono">
          {line.sku} · {formatMoney(line.unitPrice)}
          {line.discountPercent > 0 ? ` · −${line.discountPercent}%` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-7 [&_svg]:size-3.5"
          aria-label={t('One fewer {label}', { label: line.name })}
          onClick={() => onQuantity(line.quantity - 1)}
        >
          {line.quantity > 1 ? <Minus /> : <Trash2 />}
        </Button>
        <NumberField
          className="h-7 w-12 px-1 text-center text-sm"
          nullable={false}
          min={0}
          aria-label={t('Quantity of {label}', { label: line.name })}
          value={line.quantity}
          onChange={(next) => onQuantity(next ?? 0)}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-7 [&_svg]:size-3.5"
          aria-label={t('One more {label}', { label: line.name })}
          disabled={line.quantity >= max}
          onClick={() => onQuantity(line.quantity + 1)}
        >
          <Plus />
        </Button>
      </div>
      <span className="text-fg w-28 text-right text-sm font-semibold tabular-nums">
        {formatMoney(Math.round(net))}
      </span>
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
