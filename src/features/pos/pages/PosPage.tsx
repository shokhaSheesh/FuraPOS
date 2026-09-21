import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Banknote,
  ChevronDown,
  Clock,
  CreditCard,
  HandCoins,
  Landmark,
  LogOut,
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
import { Logo } from '@/shared/ui/Logo'
import { Select } from '@/shared/ui/Select'
import { DatePicker } from '@/shared/ui/DatePicker'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { demandAt } from '@/shared/lib/demand'
import { paths } from '@/shared/config/paths'
import { LanguageMenu, t, tn } from '@/shared/i18n'
import { useSession } from '@/app/providers/SessionProvider'
import { useDataStore } from '@/data/store'
import type { VariationRow } from '@/features/products/model/product'
import { useCreateSale } from '@/features/sales/api/sales'
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
import { NOBODY, TillCustomer, needsTruck, type TillBuyer } from '../components/TillCustomer'

const PAYMENTS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'transfer', label: 'Bank transfer', icon: Landmark },
  { value: 'credit', label: 'On credit', icon: HandCoins },
]

/**
 * The till (client request): a screen of its own, opened from the sidebar in
 * a new tab, where a sale is rung up rather than filled in.
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
  const { user } = useSession()
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const createSale = useCreateSale()

  // The cashier's own shop when their account names one.
  const [locationId, setLocationId] = useState<string>(
    () => user?.locationIds[0] ?? locations[0]?.id ?? '',
  )
  const location = locations.find((l) => l.id === locationId)
  const [cart, setCart] = useState<SaleLine[]>([])
  const [buyer, setBuyer] = useState<TillBuyer>(NOBODY)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [paidText, setPaidText] = useState('')
  const [appliedPromotionId, setAppliedPromotionId] = useState<string | null>(null)
  /** Everything a counter sale rarely needs, folded away until it does. */
  const [more, setMore] = useState(false)
  const [channel, setChannel] = useState<SaleChannel>('desk')
  const [comment, setComment] = useState('')
  const [deliveryOn, setDeliveryOn] = useState(false)
  const [address, setAddress] = useState('')
  const [deliveryCostText, setDeliveryCostText] = useState('')
  const [holdUntil, setHoldUntil] = useState<Date | null>(null)
  /** The sale just rung up, so the cashier can open it or hand over a number. */
  const [last, setLast] = useState<{ id: string; number: string } | null>(null)
  /** Remounts the customer block on a new sale, so its own choices clear too. */
  const [saleKey, setSaleKey] = useState(0)

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

  const deliveryCost = deliveryOn ? Number(deliveryCostText) || 0 : 0
  const totals = computeTotals(cart, Number(paidText) || 0, deliveryCost)
  const units = unitsIn(cart)
  const blocked =
    cart.length === 0 || noDrawer || needsTruck(buyer) || (deliveryOn && address.trim().length < 3)

  const reset = () => {
    setCart([])
    setBuyer(NOBODY)
    setPayment('cash')
    setPaidText('')
    setAppliedPromotionId(null)
    setChannel('desk')
    setComment('')
    setDeliveryOn(false)
    setAddress('')
    setDeliveryCostText('')
    setHoldUntil(null)
    setMore(false)
    setSaleKey((key) => key + 1)
  }

  const ring = (intent: 'pay' | 'hold') => {
    // A sale still to be delivered is not finished: it goes on as processed
    // and the delivery states carry it the rest of the way.
    const status: SaleStatus =
      intent === 'hold' ? 'postponed' : deliveryOn ? 'processed' : 'completed'
    createSale.mutate(
      {
        clientId: buyer.client?.id ?? null,
        driverId: buyer.driver?.id ?? null,
        truckPlate: buyer.truckPlate,
        locationId,
        paymentMethod: payment,
        channel,
        comment,
        paid: intent === 'pay' ? Number(paidText) || totals.total : 0,
        lines: cart,
        promotionId: appliedPromotionId,
        delivery: deliveryOn
          ? { address: address.trim(), cost: deliveryCost, scheduledFor: null, courier: null }
          : null,
        expiresAt:
          intent === 'hold'
            ? (holdUntil ?? new Date(Date.now() + 3 * 86_400_000)).toISOString()
            : null,
        status,
      },
      {
        onSuccess: (sale) => {
          setLast({ id: sale.id, number: sale.number })
          toast.success(
            intent === 'hold'
              ? t('{number} postponed', { number: sale.number })
              : deliveryOn
                ? t('{number} accepted for delivery', { number: sale.number })
                : t('{number} paid', { number: sale.number }),
          )
          reset()
        },
      },
    )
  }

  return (
    <div className="bg-canvas flex h-screen flex-col">
      <header className="border-border bg-surface flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Logo />
        <span className="bg-primary-soft text-primary rounded-full px-2.5 py-0.5 text-sm font-semibold">
          {t('Till')}
        </span>
        <Select
          className="w-56"
          aria-label={t('Location')}
          value={locationId}
          onChange={(next) => {
            if (next === locationId) return
            setLocationId(next)
            // What is in the cart was checked against the other shelf.
            if (cart.length) {
              setCart([])
              toast.info(t('Cart cleared — stock differs by location'))
            }
          }}
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
        />
        <ShiftPill open={openShift !== null} name={openShift?.registerName} />
        <div className="ml-auto flex items-center gap-2">
          {last ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={paths.sales.orderDetail(last.id)} target="_blank">
                {t('Last sale')} <span className="font-mono">{last.number}</span>
              </Link>
            </Button>
          ) : null}
          <span className="text-fg-muted text-sm">{user?.name}</span>
          <LanguageMenu />
          <Button variant="secondary" size="sm" asChild>
            <Link to={paths.sales.orders}>
              <LogOut />
              {t('Back office')}
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
        <main className="min-h-0 overflow-y-auto p-4">
          <TillCatalogue
            rows={rows}
            locationName={location?.name ?? ''}
            onAdd={(row) => add(row.variation)}
            onSet={(changes) =>
              changes.forEach(({ row, quantity }) => setUnits(row.variation.id, quantity))
            }
          />
        </main>

        <aside className="border-border bg-surface flex min-h-0 flex-col border-l">
          <div className="border-border space-y-3 border-b p-3">
            <ProductPicker onPick={add} placeholder={t('Scan a barcode or search to add…')} />
            <TillCustomer key={saleKey} buyer={buyer} onChange={setBuyer} />
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
              {totals.deliveryCost > 0 ? (
                <Row label={t('Delivery')}>+ {formatMoney(totals.deliveryCost)}</Row>
              ) : null}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-fg font-medium">{t('To pay')}</span>
                <span className="text-fg text-2xl font-semibold tabular-nums">
                  {formatMoney(totals.total)}
                </span>
              </div>
            </div>

            <div
              className="grid grid-cols-4 gap-1.5"
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

            {payment === 'cash' ? (
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
                <div className="rounded-control bg-surface-muted px-3 py-1.5 text-right">
                  <p className="text-fg-subtle text-2xs">{t('Change due')}</p>
                  <p className="text-success font-semibold tabular-nums">
                    {formatMoney(totals.change)}
                  </p>
                </div>
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
                {t('Source, delivery, comment')}
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
                  <label className="text-fg-muted flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={deliveryOn}
                      onChange={(event) => setDeliveryOn(event.target.checked)}
                      className="accent-primary size-4"
                    />
                    {t('Delivery')}
                  </label>
                  {deliveryOn ? (
                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                      <Input
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder={t('Street, building, flat')}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={deliveryCostText}
                        onChange={(event) => setDeliveryCostText(event.target.value)}
                        placeholder={t('Cost')}
                        className="text-right"
                      />
                    </div>
                  ) : null}
                  <DatePicker
                    value={holdUntil}
                    onChange={setHoldUntil}
                    placeholder={t('Hold until — 3 days by default')}
                    minDate={new Date()}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={blocked}
                onClick={() => ring('hold')}
                title={t('Postpone')}
              >
                <Clock />
                {t('Postpone')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={blocked}
                onClick={() => ring('pay')}
              >
                {deliveryOn
                  ? t('Accept order')
                  : t('Pay {total}', { total: formatMoney(totals.total) })}
              </Button>
            </div>
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

function ShiftPill({ open, name }: { open: boolean; name?: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium',
        open ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
      )}
    >
      {open ? t('Drawer open · {name}', { name }) : t('No drawer open — cash is off')}
    </span>
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
