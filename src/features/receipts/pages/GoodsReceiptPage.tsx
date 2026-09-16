import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import {
  ArrowLeft,
  ChevronDown,
  LayoutGrid,
  List,
  PackageCheck,
  Plus,
  Printer,
  Search,
  Sliders,
  Trash2,
  Upload,
} from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { ProductPicker } from '@/shared/components/ProductPicker'
import { SearchInput } from '@/shared/components/SearchInput'
import { Steps } from '@/shared/components/Steps'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Input } from '@/shared/ui/Input'
import { Popover } from '@/shared/ui/Popover'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import type { VariationRow } from '@/features/products/model/product'
import {
  buildReceiptLineColumns,
  buildReceiptReviewColumns,
  type LineRow,
} from '../components/receiptLineColumns'
import {
  basisQuantity,
  landedUnitCostOn,
  paidTotal,
  receiptDebt,
  receiptSource,
  receiptStatusLabel,
  receiptStatusTone,
  supplierInvoicedTotal,
  toUzs,
  type CostSettings,
  type GoodsReceipt,
  type ReceiptLine,
} from '../model/receipt'
import {
  useAddReceiptPayment,
  useReceipt,
  useRemoveReceiptPayment,
  useSetReceiptStatus,
  useUpdateReceipt,
} from '../api/receipts'

const STEPS = ['Add products', 'Extra data', 'Payment', 'Review and finish']

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

const COMMON_COSTS = ['Freight', 'Customs duty', 'Broker fee', 'Insurance']

/**
 * A goods receipt, from empty document to posted stock.
 *
 * It is one screen with four steps rather than four screens, because all four
 * are views of the same document and a delivery is rarely entered in one
 * sitting: the products go on as the boxes are opened, the freight invoice
 * turns up days later, and the payment later still. Any step can be opened at
 * any time for that reason — nothing here is a wizard you have to finish.
 *
 * Posting is the only irreversible act, and it lives alone on the last step.
 */
export default function GoodsReceiptPage() {
  const { receiptId = '' } = useParams()
  const navigate = useNavigate()
  const { can } = useSession()
  const { data: receipt } = useReceipt(receiptId)
  const [step, setStep] = useState(1)

  if (!receipt) {
    return (
      <EmptyState
        title="That receipt no longer exists"
        description="It may have been deleted since this link was made."
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.products.goodsReceipt}>Back to goods receipt</Link>
          </Button>
        }
      />
    )
  }

  const editable = receipt.status === 'draft' && can('products.goodsReceipt.create')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back to goods receipt" asChild>
          <Link to={paths.products.goodsReceipt}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fg text-lg font-semibold">
          Receipt {receipt.number} — {receipt.locationName}
        </h1>
        <Badge tone={receiptStatusTone(receipt.status)}>{receiptStatusLabel(receipt.status)}</Badge>
      </div>

      <Steps steps={STEPS} current={step} onSelect={setStep} selectable wide />

      {step === 1 ? (
        <ProductsStep receipt={receipt} editable={editable} />
      ) : step === 2 ? (
        <ExtraDataStep receipt={receipt} editable={editable} />
      ) : step === 3 ? (
        <PaymentStep receipt={receipt} />
      ) : (
        <ReviewStep
          receipt={receipt}
          editable={editable}
          onPosted={() => navigate(paths.products.goodsReceipt)}
        />
      )}
    </div>
  )
}

/* --- shared ------------------------------------------------------------- */

/** The receipt's lines, joined back to the catalogue the table needs to show. */
function useLineRows(receipt: GoodsReceipt): LineRow[] {
  const variations = useDataStore((s) => s.variations)
  const locations = useDataStore((s) => s.locations)

  return useMemo(
    () =>
      receipt.lines.map((line, index) => {
        const variation = variations.find((v) => v.id === line.variationId)
        return {
          ...line,
          index,
          variation,
          stockHere: (variation?.stockByLocation ?? []).map((row) => ({
            locationName: locations.find((l) => l.id === row.locationId)?.name ?? '—',
            quantity: row.quantity,
          })),
        }
      }),
    [receipt.lines, variations, locations],
  )
}

/* --- step 1: add products ----------------------------------------------- */

function ProductsStep({ receipt, editable }: { receipt: GoodsReceipt; editable: boolean }) {
  const { can } = useSession()
  const canSeeCost = can('products.cost.view')
  const update = useUpdateReceipt(receipt.id)
  const all = useLineRows(receipt)
  const [cards, setCards] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  // Filtering only what is drawn, never what is stored: the index on each row
  // still points at its place in the receipt, so editing a filtered row edits
  // the right line.
  const rows = search.trim()
    ? all.filter((row) =>
        [row.variation?.barcode, row.sku, row.name, row.variation?.productName]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(search.trim().toLowerCase())),
      )
    : all

  const writeLines = (lines: ReceiptLine[]) =>
    update.mutate({ lines }, { onError: (message) => toast.error(message) })

  /** Put a catalogue row on the receipt, or one more of a line already there. */
  const addVariation = (variation: VariationRow) => {
    const existing = receipt.lines.findIndex((line) => line.variationId === variation.id)
    if (existing > -1) {
      writeLines(
        receipt.lines.map((line, i) =>
          i === existing
            ? { ...line, receivedQuantity: (line.receivedQuantity ?? line.orderedQuantity) + 1 }
            : line,
        ),
      )
      return
    }
    writeLines([
      ...receipt.lines,
      {
        id: `grl-${receipt.id}-${receipt.lines.length + 1}`,
        variationId: variation.id,
        productId: variation.productId,
        sku: variation.sku,
        name: variation.fullName,
        imageUrl: variation.imageUrl,
        unit: variation.unit,
        // Nothing was expected — this line was found on the lorry, not ordered.
        orderedQuantity: 0,
        receivedQuantity: 1,
        // Last known cost, as a starting point the buyer corrects.
        unitCost: variation.costPrice,
        costCurrency: variation.costCurrency,
      },
    ])
  }

  const columns = buildReceiptLineColumns({
    editable,
    canSeeCost,
    cards,
    onQuantityChange: (index, quantity) =>
      writeLines(
        receipt.lines.map((line, i) =>
          i === index ? { ...line, receivedQuantity: quantity } : line,
        ),
      ),
    onCostChange: (index, unitCost) =>
      writeLines(receipt.lines.map((line, i) => (i === index ? { ...line, unitCost } : line))),
    onCurrencyChange: (index, costCurrency) =>
      writeLines(receipt.lines.map((line, i) => (i === index ? { ...line, costCurrency } : line))),
    onRemove: (index) => writeLines(receipt.lines.filter((_, i) => i !== index)),
  })

  const units = receipt.lines.reduce(
    (sum, line) => sum + (line.receivedQuantity ?? line.orderedQuantity),
    0,
  )

  return (
    <>
      {adding ? (
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ProductPicker
                onPick={addVariation}
                placeholder="Search or scan a barcode to put it on this receipt…"
              />
            </div>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Close scanning
            </Button>
          </div>
        </Card>
      ) : null}

      <DataTable
        storageKey={cards ? 'receipt-lines-cards' : 'receipt-lines'}
        columns={columns}
        data={rows}
        total={rows.length}
        getRowId={(row) => row.id}
        toolbar={
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by barcode, SKU, variation or product name…"
            />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Print these lines"
              title="Print these lines"
              onClick={() => window.print()}
            >
              <Printer />
            </Button>
            <div className="border-border rounded-control flex items-center border p-0.5">
              <Button
                variant={cards ? 'ghost' : 'secondary'}
                size="icon"
                aria-label="Show one column per field"
                aria-pressed={!cards}
                onClick={() => setCards(false)}
              >
                <List />
              </Button>
              <Button
                variant={cards ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Show each product as a card"
                aria-pressed={cards}
                onClick={() => setCards(true)}
              >
                <LayoutGrid />
              </Button>
            </div>
            {editable ? <AddProductsMenu onPickFromCatalogue={() => setAdding(true)} /> : null}
          </div>
        }
        footer={
          <div className="border-border text-fg-muted flex flex-wrap items-center gap-x-8 gap-y-1 border-t px-4 py-3 text-sm">
            <span>
              Total quantity: <strong className="text-fg font-medium">{formatNumber(units)}</strong>
            </span>
            <span>
              Product variations:{' '}
              <strong className="text-fg font-medium">{formatNumber(receipt.lines.length)}</strong>
            </span>
          </div>
        }
        emptyState={
          <EmptyState
            title="Nothing on this receipt yet"
            description="Add the products that were delivered — search the catalogue, scan them in, or upload the supplier's spreadsheet."
          />
        }
      />
    </>
  )
}

/**
 * The three ways the reference product lets products onto a receipt.
 *
 * Each one says what it is *for* under its name, because "create a new
 * product" and "pick from the catalogue" both sound like the same thing to
 * somebody standing in front of an open box for the first time.
 */
function AddProductsMenu({ onPickFromCatalogue }: { onPickFromCatalogue: () => void }) {
  const navigate = useNavigate()

  const options = [
    {
      icon: Search,
      label: 'Pick from the catalogue',
      hint: 'Search or scan what you already stock',
      onSelect: onPickFromCatalogue,
    },
    {
      icon: Upload,
      label: 'Upload a spreadsheet',
      hint: "The supplier's own list, mapped to our fields",
      onSelect: () => toast.info('Spreadsheet upload is not wired up in this build'),
    },
    {
      icon: Plus,
      label: 'Create a new product',
      hint: 'For something we have never carried before',
      onSelect: () => navigate(paths.products.new),
    },
  ]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="primary">
          <Plus />
          Add products
          <ChevronDown />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="rounded-control border-border bg-surface shadow-popover z-50 w-72 border p-1"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.label}
              onSelect={option.onSelect}
              className="rounded-control data-[highlighted]:bg-surface-muted flex cursor-pointer items-start gap-3 px-2 py-2 outline-none"
            >
              <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                <option.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="text-fg block text-sm font-medium">{option.label}</span>
                <span className="text-fg-subtle text-2xs block">{option.hint}</span>
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/* --- step 2: extra data -------------------------------------------------- */

function ExtraDataStep({ receipt, editable }: { receipt: GoodsReceipt; editable: boolean }) {
  const update = useUpdateReceipt(receipt.id)
  const [costs, setCosts] = useState(receipt.additionalCosts)
  const [comment, setComment] = useState(receipt.comment ?? '')

  const dirty =
    comment !== (receipt.comment ?? '') ||
    JSON.stringify(costs) !== JSON.stringify(receipt.additionalCosts)

  if (costs.length === 0 && !editable) {
    return (
      <EmptyState
        title="Nothing extra was recorded"
        description="Freight, duty and broker fees would appear here, and they change what every line on this delivery really cost."
      />
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle>Freight, duty and the rest</CardTitle>
          <p className="text-fg-subtle text-2xs">
            Spread across the products in proportion to their value. Leave it empty and the cost
            price is simply what the supplier charged.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          {costs.length === 0 ? (
            <p className="text-fg-subtle py-6 text-center text-sm">
              Add the extra costs and data for this receipt.
            </p>
          ) : null}

          {costs.map((cost, index) => (
            <div key={cost.id} className="flex items-end gap-2">
              <Field label="Cost" className="flex-1">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="Freight"
                    list="receipt-common-costs"
                    disabled={!editable}
                    value={cost.label}
                    onChange={(e) =>
                      setCosts(
                        costs.map((c, i) => (i === index ? { ...c, label: e.target.value } : c)),
                      )
                    }
                  />
                )}
              </Field>
              <Field label="Amount">
                {(p) => (
                  <NumberField
                    {...p}
                    className="w-36"
                    nullable={false}
                    step="any"
                    disabled={!editable}
                    value={cost.amount}
                    onChange={(v) =>
                      setCosts(costs.map((c, i) => (i === index ? { ...c, amount: v ?? 0 } : c)))
                    }
                  />
                )}
              </Field>
              <Select
                value={cost.currency}
                onChange={(v) =>
                  setCosts(
                    costs.map((c, i) => (i === index ? { ...c, currency: v as 'USD' | 'UZS' } : c)),
                  )
                }
                options={CURRENCIES}
                disabled={!editable}
                aria-label="Currency"
                className="w-24"
              />
              {editable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this cost"
                  className="hover:text-danger"
                  onClick={() => setCosts(costs.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
          <datalist id="receipt-common-costs">
            {COMMON_COSTS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>

          {editable ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setCosts([
                  ...costs,
                  {
                    id: `grc-${receipt.id}-${costs.length + 1}`,
                    label: '',
                    amount: 0,
                    currency: 'USD',
                  },
                ])
              }
            >
              <Plus />
              Add
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Note</CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="Note" hint="Anything worth knowing when this delivery is queried later">
            {(p) => (
              <Input
                {...p}
                placeholder="Part of container 3"
                disabled={!editable}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {editable ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setCosts(receipt.additionalCosts)
              setComment(receipt.comment ?? '')
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() =>
              update.mutate(
                { additionalCosts: costs, comment },
                {
                  onSuccess: () => toast.success('Saved'),
                  onError: (message) => toast.error(message),
                },
              )
            }
          >
            Save
          </Button>
        </div>
      ) : null}
    </>
  )
}

/* --- step 3: payment ----------------------------------------------------- */

function PaymentStep({ receipt }: { receipt: GoodsReceipt }) {
  const { can } = useSession()
  const addPayment = useAddReceiptPayment(receipt.id)
  const removePayment = useRemoveReceiptPayment(receipt.id)
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState<number | null>(null)
  const [currency, setCurrency] = useState<'USD' | 'UZS'>('USD')
  const [account, setAccount] = useState('Cash desk')
  const [note, setNote] = useState(`import ${receipt.number}`)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const rate = receipt.usdRate
  const invoiced = supplierInvoicedTotal(receipt, rate)
  const paid = paidTotal(receipt, rate)
  const debt = receiptDebt(receipt, rate)
  const units = receipt.lines.reduce(
    (sum, line) => sum + (line.receivedQuantity ?? line.orderedQuantity),
    0,
  )
  const canPay = can('finance.transactions.create')

  return (
    <>
      <Card className="max-w-3xl">
        <CardHeader className="items-start justify-between gap-3">
          <CardTitle>Invoice for goods from {receiptSource(receipt)}</CardTitle>
          {canPay ? (
            <Button variant="secondary" size="sm" onClick={() => setPaying((v) => !v)}>
              <Plus />
              Pay
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-fg-muted text-sm">Total quantity</p>
              <p className="text-fg mt-0.5 text-lg font-semibold">{formatNumber(units)}</p>
            </div>
            <div>
              <p className="text-fg-muted text-sm">Invoice total</p>
              <p className="text-fg mt-0.5 text-lg font-semibold">{formatMoney(invoiced)}</p>
            </div>
            <div>
              <p className="text-fg-muted text-sm">Debt (to pay)</p>
              <p
                className={`mt-0.5 text-lg font-semibold ${debt > 0 ? 'text-danger' : 'text-success'}`}
              >
                {formatMoney(debt)}
              </p>
            </div>
          </div>

          {paying ? (
            <div className="border-border rounded-card flex flex-wrap items-end gap-2 border p-3">
              <Field label="Amount">
                {(p) => (
                  <NumberField
                    {...p}
                    className="w-36"
                    step="any"
                    value={amount}
                    onChange={setAmount}
                    placeholder={String(Math.round(debt / (currency === 'USD' ? rate : 1)))}
                  />
                )}
              </Field>
              <Select
                value={currency}
                onChange={(v) => setCurrency(v as 'USD' | 'UZS')}
                options={CURRENCIES}
                aria-label="Currency"
                className="w-24"
              />
              <Field label="Account" className="min-w-40 flex-1">
                {(p) => (
                  <Input {...p} value={account} onChange={(e) => setAccount(e.target.value)} />
                )}
              </Field>
              <Field label="Note" className="min-w-40 flex-1">
                {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
              </Field>
              <Button
                variant="primary"
                onClick={() =>
                  addPayment.mutate(
                    {
                      payerName: 'Akhmet Dauletmuratov',
                      accountName: account,
                      amount: amount ?? 0,
                      currency,
                      note: note || null,
                    },
                    {
                      onSuccess: () => {
                        toast.success('Payment recorded')
                        setPaying(false)
                        setAmount(null)
                      },
                      onError: (message) => toast.error(message),
                    },
                  )
                }
              >
                Record it
              </Button>
            </div>
          ) : null}

          {receipt.payments.length === 0 ? (
            <p className="text-fg-subtle py-4 text-center text-sm">
              Nothing has been paid against this delivery yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-muted border-border border-b text-left">
                  <th className="py-2 pr-3 font-normal">Date and time</th>
                  <th className="py-2 pr-3 font-normal">Payer</th>
                  <th className="py-2 pr-3 font-normal">Account</th>
                  <th className="py-2 pr-3 text-right font-normal">Amount</th>
                  <th className="py-2 pr-3 font-normal">Note</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {receipt.payments.map((payment) => (
                  <tr key={payment.id} className="border-border border-b last:border-0">
                    <td className="text-fg-muted py-2 pr-3">{formatDateTime(payment.paidAt)}</td>
                    <td className="py-2 pr-3">{payment.payerName}</td>
                    <td className="py-2 pr-3">{payment.accountName}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {payment.currency === 'USD'
                        ? `${payment.amount.toFixed(2)} USD`
                        : formatMoney(payment.amount)}
                    </td>
                    <td className="text-fg-muted py-2 pr-3">{payment.note ?? '—'}</td>
                    <td className="py-2">
                      {canPay ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove this payment"
                          className="hover:text-danger"
                          onClick={() => setPendingDelete(payment.id)}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-fg-muted">
                  <td className="py-2 pr-3" colSpan={3}>
                    Paid so far
                  </td>
                  <td className="text-fg py-2 pr-3 text-right font-medium tabular-nums">
                    {formatMoney(paid)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove this payment?"
        confirmLabel="Remove it"
        body="The delivery goes back to being unpaid by that amount."
        onConfirm={() => {
          if (pendingDelete) removePayment.mutate(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </>
  )
}

/* --- step 4: review and finish ------------------------------------------- */

function ReviewStep({
  receipt,
  editable,
  onPosted,
}: {
  receipt: GoodsReceipt
  editable: boolean
  onPosted: () => void
}) {
  const { can } = useSession()
  const canSeeCost = can('products.cost.view')
  const update = useUpdateReceipt(receipt.id)
  const post = useSetReceiptStatus(receipt.id)
  const all = useLineRows(receipt)
  const [confirming, setConfirming] = useState(false)
  const [search, setSearch] = useState('')
  const settings = receipt.costSettings

  const rows = search.trim()
    ? all.filter((row) =>
        [row.variation?.barcode, row.sku, row.name, row.variation?.productName]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(search.trim().toLowerCase())),
      )
    : all

  const setSettings = (next: Partial<CostSettings>) =>
    update.mutate(
      { costSettings: { ...settings, ...next } },
      { onError: (message) => toast.error(message) },
    )

  const columns = buildReceiptReviewColumns({
    canSeeCost,
    costLabel: `Cost price (per unit)${settings.currency === 'uzs' ? '' : ', as invoiced'}`,
    landedCostOf: (row) => {
      const uzs = landedUnitCostOn(row, receipt, receipt.usdRate, settings.basis)
      if (settings.currency === 'uzs') return formatMoney(Math.round(uzs))
      // "As invoiced" means the supplier's own currency, so a buyer can check
      // the figure against the invoice in front of them without doing the
      // conversion in their head.
      return row.costCurrency === 'USD'
        ? `${(uzs / receipt.usdRate).toFixed(2)} USD`
        : formatMoney(Math.round(uzs))
    },
  })

  const quantities = Object.fromEntries(
    receipt.lines.map((line) => [line.id, basisQuantity(line, settings.basis)]),
  )
  const units = Object.values(quantities).reduce((sum, q) => sum + q, 0)

  return (
    <>
      <DataTable
        storageKey="receipt-review"
        columns={columns}
        data={rows}
        total={rows.length}
        getRowId={(row) => row.id}
        toolbar={
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by barcode, SKU, variation or product name…"
            />
            <div className="flex-1" />
            <CostSettingsMenu settings={settings} editable={editable} onChange={setSettings} />
            {editable ? (
              <Button variant="primary" onClick={() => setConfirming(true)}>
                <PackageCheck />
                Post receipt
              </Button>
            ) : null}
          </div>
        }
        footer={
          <div className="border-border text-fg-muted flex flex-wrap items-center gap-x-8 gap-y-1 border-t px-4 py-3 text-sm">
            <span>
              Total quantity: <strong className="text-fg font-medium">{formatNumber(units)}</strong>
            </span>
            <span>
              Goods value:{' '}
              <strong className="text-fg font-medium">
                {formatMoney(
                  receipt.lines.reduce(
                    (sum, line) =>
                      sum +
                      basisQuantity(line, settings.basis) *
                        toUzs(line.unitCost, line.costCurrency, receipt.usdRate),
                    0,
                  ),
                )}
              </strong>
            </span>
          </div>
        }
        emptyState={
          <EmptyState
            title="There is nothing to review"
            description="Put some products on the first step and they will appear here."
          />
        }
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Post this receipt?"
        confirmLabel="Post it"
        body={
          <>
            {formatNumber(units)} units land at{' '}
            <strong className="text-fg font-medium">{receipt.locationName}</strong>, and every
            product on it takes the cost price shown above. Posting cannot be undone — a mistake
            afterwards is fixed with a correction.
          </>
        }
        onConfirm={() =>
          post.mutate(
            { to: 'received', quantities },
            {
              onSuccess: () => {
                toast.success(`${receipt.number} posted into ${receipt.locationName}`)
                setConfirming(false)
                onPosted()
              },
              onError: (message) => toast.error(message),
            },
          )
        }
      />
    </>
  )
}

/** How the review step's cost price is worked out — the reference's own two questions. */
function CostSettingsMenu({
  settings,
  editable,
  onChange,
}: {
  settings: CostSettings
  editable: boolean
  onChange: (next: Partial<CostSettings>) => void
}) {
  return (
    <Popover
      align="end"
      trigger={
        <Button variant="secondary">
          <Sliders />
          Cost price settings
          <ChevronDown />
        </Button>
      }
    >
      <div className="w-64 space-y-3">
        <Field label="Cost price currency">
          {(p) => (
            <Select
              {...p}
              className="w-full"
              value={settings.currency}
              disabled={!editable}
              onChange={(v) => onChange({ currency: v as CostSettings['currency'] })}
              options={[
                { value: 'uzs', label: 'UZS' },
                { value: 'supplier', label: "The supplier's price" },
              ]}
            />
          )}
        </Field>
        <Field label="Show cost price by">
          {(p) => (
            <Select
              {...p}
              className="w-full"
              value={settings.basis}
              disabled={!editable}
              onChange={(v) => onChange({ basis: v as CostSettings['basis'] })}
              options={[
                { value: 'actual', label: 'Actual quantity' },
                { value: 'expected', label: 'Expected quantity' },
              ]}
            />
          )}
        </Field>
      </div>
    </Popover>
  )
}
