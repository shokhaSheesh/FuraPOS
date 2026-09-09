import { useState } from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { Checkbox } from '@/shared/ui/Checkbox'
import { toast } from '@/shared/ui/toast'
import { formatDateTime } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { PAYMENT_METHODS, SALE_STATUSES } from '@/features/sales/model/sale'
import { INDUSTRIES, companySchema, type CompanyDraft } from '../model/settings'

/**
 * General settings.
 *
 * OX's «Основные» carries company details, a map provider, a delivery-distance
 * method, a base unit weight and a password policy. Half of those belong to
 * features this product does not have.
 *
 * Currency, locale and time zone were here too and are deliberately gone: a
 * currency picker that changes the symbol without converting anything is a trap,
 * not a setting. What is left is the company, the dollar rate, and the two rules
 * that change numbers elsewhere — which payment methods a sale may use, and
 * which statuses count as revenue.
 */
export default function GeneralSettingsPage() {
  const company = useDataStore((s) => s.company)
  const updateCompany = useDataStore((s) => s.updateCompany)

  const [draft, setDraft] = useState<CompanyDraft>({
    name: company.name,
    industry: company.industry,
    address: company.address,
    phone: company.phone,
    email: company.email,
    usdRate: company.usdRate,
    paymentMethods: company.paymentMethods,
    allowOverCreditLimit: company.allowOverCreditLimit,
    revenueStatuses: company.revenueStatuses,
  })
  const [showErrors, setShowErrors] = useState(false)

  const parsed = companySchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const toggle = (key: 'paymentMethods' | 'revenueStatuses', value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((entry) => entry !== value)
        : [...current[key], value],
    }))

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) {
      toast.error('Check the highlighted fields')
      return
    }
    updateCompany(draft)
    toast.success('Settings saved')
  }

  return (
    <>
      <PageHeader
        title="General"
        description="Who the company is, the dollar rate behind every cost, and the two rules that change numbers on other screens."
        action={
          <Button variant="primary" onClick={save}>
            <Save />
            Save changes
          </Button>
        }
        below={
          <span className="text-fg-subtle text-2xs">
            Last changed {formatDateTime(company.updatedAt)}
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                value={draft.name}
                onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Industry">
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={draft.industry}
                onChange={(industry) => setDraft((c) => ({ ...c, industry }))}
                options={INDUSTRIES.map((entry) => ({ value: entry, label: entry }))}
              />
            )}
          </Field>
          <Field label="Address" className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={draft.address ?? ''}
                onChange={(e) => setDraft((c) => ({ ...c, address: e.target.value || null }))}
              />
            )}
          </Field>
          <Field label="Phone">
            {(p) => (
              <Input
                {...p}
                value={draft.phone ?? ''}
                onChange={(e) => setDraft((c) => ({ ...c, phone: e.target.value || null }))}
              />
            )}
          </Field>
          <Field label="Email" error={errors.email?.[0]}>
            {(p) => (
              <Input
                {...p}
                value={draft.email ?? ''}
                onChange={(e) => setDraft((c) => ({ ...c, email: e.target.value || null }))}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle>Exchange rate</CardTitle>
          <p className="text-fg-subtle text-2xs">
            Suppliers invoice in dollars and customers pay in so'm, so this one number sits behind
            every landed cost, margin and order value in the product.
          </p>
        </CardHeader>
        <CardBody>
          <Field label="US dollar rate" required error={errors.usdRate?.[0]}>
            {(p) => (
              <NumberField
                {...p}
                className="w-full sm:max-w-56"
                nullable={false}
                min={1}
                value={draft.usdRate}
                onChange={(usdRate) => setDraft((c) => ({ ...c, usdRate: usdRate ?? 1 }))}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          <CardTitle>Sales rules</CardTitle>
          <p className="text-fg-subtle text-2xs">
            The two settings here change numbers on other screens, so they are worth reading twice.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="space-y-2">
            <p className="text-fg-muted text-sm">
              How a sale can be paid<span className="text-danger ml-0.5">*</span>
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    aria-label={method.label}
                    checked={draft.paymentMethods.includes(method.value)}
                    onCheckedChange={() => toggle('paymentMethods', method.value)}
                  />
                  <span className="text-fg">{method.label}</span>
                </label>
              ))}
            </div>
            {errors.paymentMethods?.[0] ? (
              <p className="text-danger text-2xs">{errors.paymentMethods[0]}</p>
            ) : null}
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="text-fg block text-sm font-medium">
                Allow a sale past a client's credit limit
              </span>
              <span className="text-fg-subtle text-2xs">
                Off means the limit stops the sale. On means it only warns — which is a decision
                about trust, not about software.
              </span>
            </span>
            <Switch
              aria-label="Allow a sale past a credit limit"
              checked={draft.allowOverCreditLimit}
              onCheckedChange={(allowOverCreditLimit) =>
                setDraft((c) => ({ ...c, allowOverCreditLimit }))
              }
            />
          </label>

          <div className="space-y-2">
            <p className="text-fg-muted text-sm">
              What counts as revenue<span className="text-danger ml-0.5">*</span>
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {SALE_STATUSES.filter((status) => status.value !== 'deleted').map((status) => (
                <label
                  key={status.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    aria-label={status.label}
                    checked={draft.revenueStatuses.includes(status.value)}
                    onCheckedChange={() => toggle('revenueStatuses', status.value)}
                  />
                  <span className="text-fg">{status.label}</span>
                </label>
              ))}
            </div>
            {errors.revenueStatuses?.[0] ? (
              <p className="text-danger text-2xs">{errors.revenueStatuses[0]}</p>
            ) : null}
            <div className="text-fg-muted text-2xs flex items-start gap-2 pt-1">
              <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" />
              {/* Said plainly: this is the setting most likely to make two
                  people quote different revenue figures at each other. */}
              <p>
                Every figure in Analytics moves when this changes. Counting an open sale as revenue
                flatters the dashboard and the reports alike. Deleted sales never count, whatever is
                ticked here.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  )
}
