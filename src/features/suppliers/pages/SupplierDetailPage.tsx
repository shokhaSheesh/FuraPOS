import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Banknote, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { WalletPanel } from '@/shared/components/WalletPanel'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { usePaySupplier, useSupplier, useSupplierWallet } from '../api/suppliers'
import { daysOverdue, isDormant, paymentSchema, type PaymentValues } from '../model/supplier'

export default function SupplierDetailPage() {
  const { supplierId } = useParams()
  const { can } = useSession()
  const { data } = useSupplier(supplierId ?? '')
  const { wallet, transactions } = useSupplierWallet(supplierId ?? '')
  const pay = usePaySupplier(supplierId ?? '')
  const receipts = useDataStore((s) => s.receipts)
  const [paying, setPaying] = useState(false)

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, comment: '' },
  })

  if (!data) {
    return <EmptyState title="Supplier not found" description="It may have been deleted." />
  }

  const { supplier, stats } = data
  const canSeeCost = can('products.cost.view')
  const overdue = daysOverdue(supplier)
  const theirReceipts = receipts
    .filter((receipt) => receipt.supplierId === supplier.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  const submitPayment = form.handleSubmit((values) => {
    pay.mutate(values, {
      onSuccess: () => {
        toast.success(`${formatMoney(values.amount)} recorded against ${supplier.name}`)
        setPaying(false)
        form.reset({ amount: 0, comment: '' })
      },
      onError: (message) => toast.error(message),
    })
  })

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.suppliers}>
          <ArrowLeft />
          Suppliers
        </Link>
      </Button>

      <PageHeader
        title={supplier.name}
        description={[supplier.contactName, supplier.phone, supplier.zone]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex items-center gap-2">
            {can('products.suppliers.edit') ? (
              <Button variant="secondary" asChild>
                <Link to={paths.products.editSupplier(supplier.id)}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            ) : null}
            {supplier.debt > 0 && can('products.suppliers.edit') ? (
              <Button variant="primary" onClick={() => setPaying(true)}>
                <Banknote />
                Record a payment
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={supplier.status === 'active' ? 'success' : 'neutral'}>
              {supplier.status === 'active' ? 'Active' : 'Archived'}
            </Badge>
            {supplier.debt > 0 ? (
              <Badge tone="danger">{formatMoney(supplier.debt)} owed</Badge>
            ) : (
              <Badge tone="success">Nothing owed</Badge>
            )}
            {overdue ? (
              <span className="text-danger text-sm">
                {formatNumber(overdue)} days past the {supplier.paymentTermDays}-day terms
              </span>
            ) : null}
            {isDormant(stats) ? <Badge tone="warning">No delivery in 90 days</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Bought from them"
          value={canSeeCost ? formatMoney(stats.purchased) : formatNumber(stats.purchasedUnits)}
          meta={`${formatNumber(stats.receipts)} deliveries · ${formatNumber(stats.products)} products`}
        />
        <Figure
          label="Sold on"
          value={formatPercent(stats.soldRatio)}
          meta={canSeeCost ? `${formatMoney(stats.soldValue)} of it` : 'of what they sent'}
        />
        <Figure
          label="Still on the shelf"
          value={canSeeCost ? formatMoney(stats.onHandValue) : formatNumber(stats.onHandUnits)}
          meta={`${formatNumber(stats.onHandUnits)} units`}
        />
        <Figure
          label="Last delivery"
          value={stats.lastReceiptAt ? formatDate(stats.lastReceiptAt) : 'Never'}
          meta={supplier.paymentTermDays ? `${supplier.paymentTermDays}-day terms` : 'No terms set'}
        />
      </div>

      {/*
        The shared wallet, first of its three owners. Suppliers have no
        cashback, and the balance reads as money owed rather than held — which
        is the whole reason the component takes its labels from the caller.
      */}
      <WalletPanel
        wallet={wallet}
        transactions={transactions}
        showCashback={false}
        labels={{
          balance: 'We owe',
          debt: 'Outstanding',
          ledgerEmpty: 'No invoices or payments have been recorded against this supplier yet.',
        }}
        insights={
          supplier.debt > 0 && overdue
            ? [
                {
                  id: 'overdue',
                  title: 'This account is past its terms',
                  body: `${formatMoney(supplier.debt)} has been outstanding for ${formatNumber(
                    overdue,
                  )} days beyond the agreed ${supplier.paymentTermDays} days. Paying late is usually cheaper than it looks until a supplier changes their terms.`,
                  tone: 'risk',
                  generatedAt: new Date().toISOString(),
                },
              ]
            : []
        }
        action={
          supplier.debt > 0 && can('products.suppliers.edit') ? (
            <Button variant="secondary" size="sm" onClick={() => setPaying(true)}>
              <Banknote />
              Record a payment
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent deliveries</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {theirReceipts.length === 0 ? (
              <p className="text-fg-subtle p-4 text-sm">
                Nothing has been received from {supplier.name} yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-4 py-2 text-left font-semibold">Receipt</th>
                      <th className="px-4 py-2 text-left font-semibold">Landed at</th>
                      <th className="px-4 py-2 text-right font-semibold">Items</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theirReceipts.map((receipt) => (
                      <tr key={receipt.id} className="border-border border-t">
                        <td className="px-4 py-2">
                          <Link
                            to={paths.products.goodsReceiptDetail(receipt.id)}
                            className="text-fg text-2xs font-mono hover:underline"
                          >
                            {receipt.number}
                          </Link>
                          <span className="text-fg-subtle text-2xs ml-2">
                            {formatDate(receipt.createdAt)}
                          </span>
                        </td>
                        <td className="text-fg-muted px-4 py-2">{receipt.locationName}</td>
                        <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                          {formatNumber(receipt.lines.length)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            tone={
                              receipt.status === 'received'
                                ? 'success'
                                : receipt.status === 'draft'
                                  ? 'neutral'
                                  : 'danger'
                            }
                          >
                            {receipt.status === 'received'
                              ? 'Received'
                              : receipt.status === 'draft'
                                ? 'Draft'
                                : 'Cancelled'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Row label="Contact" value={supplier.contactName ?? '—'} />
            <Row label="Phone" value={supplier.phone ?? '—'} />
            <Row label="Email" value={supplier.email ?? '—'} />
            <Row label="Zone" value={supplier.zone ?? '—'} />
            <Row label="Address" value={supplier.address ?? '—'} />
            <Row
              label="Payment terms"
              value={supplier.paymentTermDays ? `${supplier.paymentTermDays} days` : 'Not agreed'}
            />
            {supplier.comment ? <Row label="Note" value={supplier.comment} /> : null}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={paying}
        onOpenChange={(open) => {
          setPaying(open)
          if (!open) form.reset({ amount: 0, comment: '' })
        }}
        title={`Record a payment to ${supplier.name}`}
        description={`${formatMoney(supplier.debt)} is outstanding. This records money already sent — it does not send anything.`}
        primary={{ label: 'Record payment', onClick: submitPayment }}
      >
        <div className="space-y-3">
          <Field label="Amount" required error={form.formState.errors.amount?.message}>
            {(p) => (
              <NumberField
                {...p}
                className="w-full"
                nullable={false}
                value={form.watch('amount')}
                onChange={(next) => form.setValue('amount', next ?? 0, { shouldValidate: true })}
              />
            )}
          </Field>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => form.setValue('amount', supplier.debt, { shouldValidate: true })}
          >
            Pay it all — {formatMoney(supplier.debt)}
          </Button>
          <Field label="Reference" hint="Transfer number, or how it was paid">
            {(p) => <Input {...p} placeholder="Bank transfer" {...form.register('comment')} />}
          </Field>
        </div>
      </Modal>
    </>
  )
}

function Figure({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <Card className="p-4">
      <p className="text-fg-muted text-sm">{label}</p>
      <p className="text-fg mt-0.5 text-lg font-semibold">{value}</p>
      <p className="text-fg-subtle text-2xs">{meta}</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-fg-muted shrink-0">{label}</span>
      <span className="text-fg text-right">{value}</span>
    </div>
  )
}
