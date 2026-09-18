import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  ArrowLeft,
  Banknote,
  Copy,
  KeyRound,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Wand2,
} from 'lucide-react'
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
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import {
  usePaySupplier,
  useSetSupplierAccess,
  useSetSupplierPassword,
  useSupplier,
  useSupplierWallet,
} from '../api/suppliers'
import { OLDEST_FIRST, outstanding, settlementsFor } from '../model/settlement'
import {
  daysOverdue,
  generatePassword,
  isDormant,
  paymentSchema,
  portalState,
  portalStateHint,
  portalStateLabel,
  portalStateTone,
  type PaymentValues,
} from '../model/supplier'
import { t, tn } from '@/shared/i18n'

export default function SupplierDetailPage() {
  const { supplierId } = useParams()
  const { can } = useSession()
  const { data } = useSupplier(supplierId ?? '')
  const { wallet, transactions } = useSupplierWallet(supplierId ?? '')
  const pay = usePaySupplier(supplierId ?? '')
  const setPassword = useSetSupplierPassword(supplierId ?? '')
  const setAccess = useSetSupplierAccess(supplierId ?? '')
  const receipts = useDataStore((s) => s.receipts)
  const roles = useDataStore((s) => s.roles)
  const [paying, setPaying] = useState(false)
  /** The change-password dialog, and what is typed in it. */
  const [changing, setChanging] = useState(false)
  const [draftPassword, setDraftPassword] = useState('')

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, comment: '', receiptId: OLDEST_FIRST },
  })

  if (!data) {
    return (
      <EmptyState title={t('Supplier not found')} description={t('It may have been deleted.')} />
    )
  }

  const { supplier, stats } = data
  const canSeeCost = can('products.cost.view')
  const canSeePortal = can('products.supplierPortal.view')
  const canManagePortal = can('products.supplierPortal.edit')
  const portal = portalState(supplier)
  const overdue = daysOverdue(supplier)
  const theirReceipts = receipts
    .filter((receipt) => receipt.supplierId === supplier.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  const settlements = settlementsFor(
    receipts.filter((receipt) => receipt.supplierId === supplier.id),
    transactions,
  )
  const unpaid = outstanding(settlements)
  /** Only the deliveries actually on screen, so the footer totals what is shown. */
  const listed = settlements.filter((entry) =>
    theirReceipts.some((receipt) => receipt.id === entry.receiptId),
  )
  const paidFor = form.watch('receiptId')
  /** "Pay it all" means this invoice when one is chosen, the account otherwise. */
  const payableNow = unpaid.find((entry) => entry.receiptId === paidFor)?.pending ?? supplier.debt

  const submitPayment = form.handleSubmit((values) => {
    pay.mutate(
      {
        ...values,
        receiptId: values.receiptId === OLDEST_FIRST ? null : values.receiptId,
      },
      {
        onSuccess: () => {
          toast.success(
            t('{p0} recorded against {name}', {
              p0: formatMoney(values.amount),
              name: supplier.name,
            }),
          )
          setPaying(false)
          form.reset({ amount: 0, comment: '', receiptId: OLDEST_FIRST })
        },
        onError: (message) => toast.error(message),
      },
    )
  })

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.products.suppliers}>
          <ArrowLeft />
          {t('Suppliers')}
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
                  {t('Edit')}
                </Link>
              </Button>
            ) : null}
            {supplier.debt > 0 && can('products.suppliers.edit') ? (
              <Button variant="primary" onClick={() => setPaying(true)}>
                <Banknote />
                {t('Record a payment')}
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={supplier.status === 'active' ? 'success' : 'neutral'}>
              {supplier.status === 'active' ? t('Active') : t('Archived')}
            </Badge>
            {supplier.debt > 0 ? (
              <Badge tone="danger">
                {formatMoney(supplier.debt)} {t('owed')}
              </Badge>
            ) : (
              <Badge tone="success">{t('Nothing owed')}</Badge>
            )}
            {overdue ? (
              <span className="text-danger text-sm">
                {formatNumber(overdue)} {t('days past the')} {supplier.paymentTermDays}
                {t('-day terms')}
              </span>
            ) : null}
            {isDormant(stats) ? <Badge tone="warning">{t('No delivery in 90 days')}</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label={t('Bought from them')}
          value={canSeeCost ? formatMoney(stats.purchased) : formatNumber(stats.purchasedUnits)}
          meta={`${formatNumber(stats.receipts)} deliveries · ${formatNumber(stats.products)} products`}
        />
        <Figure
          label={t('Sold on')}
          value={formatPercent(stats.soldRatio)}
          meta={canSeeCost ? `${formatMoney(stats.soldValue)} of it` : 'of what they sent'}
        />
        <Figure
          label={t('Still on the shelf')}
          value={canSeeCost ? formatMoney(stats.onHandValue) : formatNumber(stats.onHandUnits)}
          meta={`${formatNumber(stats.onHandUnits)} units`}
        />
        <Figure
          label={t('Last delivery')}
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
        // Every charge came from a delivery, so the row opens it.
        referenceHref={(entry) =>
          entry.referenceType === 'goods_receipt' && entry.referenceId
            ? paths.products.goodsReceiptDetail(entry.referenceId)
            : null
        }
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
                  title: t('This account is past its terms'),
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
              {t('Record a payment')}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('Recent deliveries')}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {theirReceipts.length === 0 ? (
              <p className="text-fg-subtle p-4 text-sm">
                {t('Nothing has been received from')} {supplier.name} {t('yet.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                      <th className="px-4 py-2 text-left font-semibold">{t('Receipt')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('Landed at')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('Invoiced')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('Paid')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('Pending')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('Status')}</th>
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
                        {/* What it cost, what has been paid against it, and what
                            is left — the three figures somebody needs when the
                            supplier rings about one invoice. */}
                        {(() => {
                          const settled = settlements.find((s) => s.receiptId === receipt.id)
                          if (!settled) {
                            return (
                              <td className="text-fg-subtle px-4 py-2 text-right" colSpan={3}>
                                {t('Nothing charged')}
                              </td>
                            )
                          }
                          return (
                            <>
                              <td className="text-fg-muted px-4 py-2 text-right tabular-nums">
                                {formatMoney(settled.invoiced)}
                              </td>
                              <td className="text-success px-4 py-2 text-right tabular-nums">
                                {settled.paid > 0 ? formatMoney(settled.paid) : '—'}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {settled.pending > 0 ? (
                                  <span className="text-danger font-medium">
                                    {formatMoney(settled.pending)}
                                  </span>
                                ) : (
                                  // A dash, not a badge: the Status column
                                  // already carries one, and two badges on a row
                                  // makes neither of them mean anything.
                                  <span className="text-fg-subtle">—</span>
                                )}
                              </td>
                            </>
                          )
                        })()}
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
                              ? t('Received')
                              : receipt.status === 'draft'
                                ? t('Draft')
                                : t('Cancelled')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/*
                    The totals, so the Pending column can be read against the
                    debt at the top of the page rather than added up by eye.
                    This is the same question one level up: a figure you cannot
                    reconcile is a figure you cannot trust.
                  */}
                  <tfoot className="bg-canvas">
                    <tr className="border-border text-2xs border-t font-semibold">
                      <td className="text-fg-muted px-4 py-2" colSpan={2}>
                        {theirReceipts.length === stats.receipts
                          ? t('All deliveries')
                          : t('These {p0} deliveries', { p0: formatNumber(theirReceipts.length) })}
                      </td>
                      <td className="text-fg px-4 py-2 text-right tabular-nums">
                        {formatMoney(listed.reduce((sum, entry) => sum + entry.invoiced, 0))}
                      </td>
                      <td className="text-success px-4 py-2 text-right tabular-nums">
                        {formatMoney(listed.reduce((sum, entry) => sum + entry.paid, 0))}
                      </td>
                      <td className="text-danger px-4 py-2 text-right tabular-nums">
                        {formatMoney(listed.reduce((sum, entry) => sum + entry.pending, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Both cards describe the same company, so they stack in one column
            rather than leaving a gap beside the deliveries table. */}
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>{t('Manager')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Row label={t('Name')} value={supplier.contactName ?? '—'} />
              <Row label={t('Phone')} value={supplier.phone ?? '—'} />
              <Row label={t('Email')} value={supplier.email ?? '—'} />
              <Row label={t('Zone')} value={supplier.zone ?? '—'} />
              <Row label={t('Address')} value={supplier.address ?? '—'} />
              <Row
                label={t('Payment terms')}
                value={supplier.paymentTermDays ? `${supplier.paymentTermDays} days` : 'Not agreed'}
              />
              {supplier.comment ? <Row label={t('Note')} value={supplier.comment} /> : null}
            </CardBody>
          </Card>

          {/* Their own way in. Read-only to them and nothing to do with our
            sales: the portal shows what we order from this company. */}
          {canSeePortal ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('Supplier portal')}</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={portalStateTone(portal)}>{portalStateLabel(portal)}</Badge>
                  <span className="text-fg-subtle text-2xs text-right">
                    {portalStateHint(portal)}
                  </span>
                </div>

                {!supplier.username ? (
                  <p className="text-fg-muted">
                    {supplier.contactName ?? t('Nobody here')}{' '}
                    {t('cannot sign in. A login is created by editing this supplier.')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Row label={t('Login')} value={supplier.username ?? '—'} mono />
                    <Row
                      label={t('Role')}
                      value={roles.find((role) => role.id === supplier.roleId)?.name ?? 'No role'}
                    />
                    {/* Readable, because the person handing it over has to be
                        able to read it out when the supplier rings back. */}
                    <Row label={t('Password')} value={supplier.password ?? '—'} mono />
                    <Row
                      label={t('Changed')}
                      value={supplier.passwordSetAt ? formatDate(supplier.passwordSetAt) : 'Never'}
                    />
                    <Row
                      label={t('Last signed in')}
                      value={
                        supplier.lastSignedInAt ? formatDate(supplier.lastSignedInAt) : 'Never'
                      }
                    />
                    {canManagePortal ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          void navigator.clipboard
                            ?.writeText(
                              `Login: ${supplier.username}\nPassword: ${supplier.password}`,
                            )
                            .then(() => toast.success(t('Login and password copied')))
                            .catch(() => toast.error(t('Could not copy — select the text instead')))
                        }
                      >
                        <Copy />
                        {t('Copy both')}
                      </Button>
                    ) : null}
                  </div>
                )}

                {canManagePortal && supplier.username ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDraftPassword(supplier.password ?? '')
                        setChanging(true)
                      }}
                    >
                      <KeyRound />
                      {supplier.password ? t('Change password') : t('Set a password')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setAccess.mutate(supplier.access === 'disabled' ? 'granted' : 'disabled', {
                          onSuccess: () =>
                            toast.success(
                              supplier.access === 'disabled'
                                ? `${supplier.name} can sign in again`
                                : `${supplier.name} can no longer sign in`,
                            ),
                        })
                      }
                    >
                      {supplier.access === 'disabled' ? <ShieldCheck /> : <ShieldOff />}
                      {supplier.access === 'disabled'
                        ? t('Switch access back on')
                        : t('Switch access off')}
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={paying}
        onOpenChange={(open) => {
          setPaying(open)
          if (!open) form.reset({ amount: 0, comment: '' })
        }}
        title={t('Record a payment to {name}', { name: supplier.name })}
        description={t(
          '{p0} is outstanding. This records money already sent — it does not send anything.',
          { p0: formatMoney(supplier.debt) },
        )}
        primary={{ label: t('Record payment'), onClick: submitPayment }}
      >
        <div className="space-y-3">
          {/* Which invoice the money is for. Without this a payment lands on
              the account as a lump and nobody can tell afterwards which
              deliveries it settled. */}
          <Field
            label={t('Paying for')}
            hint={t('Pick the delivery this payment covers, or spread it across the oldest first')}
          >
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={paidFor}
                onChange={(next) => {
                  form.setValue('receiptId', next)
                  const chosen = unpaid.find((entry) => entry.receiptId === next)
                  // Paying an invoice almost always means paying it in full.
                  form.setValue('amount', chosen ? chosen.pending : supplier.debt, {
                    shouldValidate: true,
                  })
                }}
                options={[
                  {
                    value: OLDEST_FIRST,
                    label: t('Oldest first — across {length} {p1}', {
                      length: unpaid.length,
                      p1: tn(unpaid.length, 'delivery', 'deliveries'),
                    }),
                  },
                  ...unpaid.map((entry) => ({
                    value: entry.receiptId,
                    label: t('{number} — {p1} pending', {
                      number: entry.number,
                      p1: formatMoney(entry.pending),
                    }),
                  })),
                ]}
              />
            )}
          </Field>
          <Field label={t('Amount')} required error={form.formState.errors.amount?.message}>
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
            onClick={() => form.setValue('amount', payableNow, { shouldValidate: true })}
          >
            {t('Pay it all —')} {formatMoney(payableNow)}
          </Button>
          <Field label={t('Reference')} hint={t('Transfer number, or how it was paid')}>
            {(p) => <Input {...p} placeholder={t('Bank transfer')} {...form.register('comment')} />}
          </Field>
        </div>
      </Modal>

      <Modal
        open={changing}
        onOpenChange={setChanging}
        title={t('Password for {name}', { name: supplier.name })}
        description={t(
          '{p0} signs in as {username}. Type one or generate it — either way it stays readable here.',
          { p0: supplier.contactName ?? t('Their manager'), username: supplier.username },
        )}
        size="sm"
        primary={{
          label: t('Save password'),
          onClick: () =>
            setPassword.mutate(draftPassword, {
              onSuccess: () => {
                toast.success(t('Password changed'))
                setChanging(false)
              },
              onError: (message) => toast.error(message),
            }),
        }}
      >
        <Field label={t('Password')} required hint={t('At least 8 characters')}>
          {(p) => (
            <div className="flex gap-2">
              <Input
                {...p}
                className="flex-1 font-mono"
                value={draftPassword}
                onChange={(event) => setDraftPassword(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraftPassword(generatePassword())}
              >
                <Wand2 />
                {t('Generate')}
              </Button>
            </div>
          )}
        </Field>
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-fg-muted shrink-0">{label}</span>
      {/* A login is read character by character, so it gets a mono face. */}
      <span className={mono ? 'text-fg text-right font-mono' : 'text-fg text-right'}>{value}</span>
    </div>
  )
}
