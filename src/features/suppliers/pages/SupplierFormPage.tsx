import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Wand2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { useDataStore } from '@/data/store'
import { useCreateSupplier, useSupplier, useUpdateSupplier } from '../api/suppliers'
import {
  generatePassword,
  isUsernameTaken,
  suggestUsername,
  supplierFormSchema,
  type SupplierFormValues,
} from '../model/supplier'

/**
 * Create and edit a supplier. Contact details only — what we owe them comes
 * from receipts and payments, never from a form, because a debt someone can
 * type is a debt nobody can trust.
 */
export default function SupplierFormPage() {
  const navigate = useNavigate()
  const { supplierId } = useParams()
  const editing = Boolean(supplierId && supplierId !== 'new')

  const { can } = useSession()
  const { data: existing } = useSupplier(editing ? supplierId! : '')
  const suppliers = useDataStore((s) => s.suppliers)
  const create = useCreateSupplier()
  const update = useUpdateSupplier(supplierId ?? '')

  const defaults = useMemo<SupplierFormValues>(
    () =>
      existing
        ? {
            name: existing.supplier.name,
            zone: existing.supplier.zone ?? '',
            contactName: existing.supplier.contactName ?? '',
            phone: existing.supplier.phone ?? '',
            email: existing.supplier.email ?? '',
            address: existing.supplier.address ?? '',
            paymentTermDays: existing.supplier.paymentTermDays,
            comment: existing.supplier.comment ?? '',
            status: existing.supplier.status,
            access: existing.supplier.access,
            username: existing.supplier.username ?? '',
            password: existing.supplier.password ?? '',
          }
        : {
            name: '',
            zone: '',
            contactName: '',
            phone: '',
            email: '',
            address: '',
            paymentTermDays: null,
            comment: '',
            status: 'active',
            access: 'none',
            username: '',
            password: '',
          },
    [existing],
  )

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: defaults,
    values: defaults,
  })

  const access = form.watch('access')

  const submit = form.handleSubmit(
    (values) => {
      // Empty strings become null on the way in, so a missing phone number is
      // absent rather than an empty string pretending to be one.
      const payload = {
        name: values.name.trim(),
        zone: values.zone.trim() || null,
        contactName: values.contactName.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        address: values.address.trim() || null,
        paymentTermDays: values.paymentTermDays,
        comment: values.comment.trim() || null,
        status: values.status,
        access: values.access,
        username: values.username.trim() || null,
        password: values.password.trim() || null,
      }

      // Two companies signing in as one name would be two companies in one
      // account, and the schema cannot see the other suppliers to catch it.
      if (payload.username && isUsernameTaken(suppliers, payload.username, supplierId)) {
        form.setError('username', { message: 'Another supplier already signs in with this login' })
        toast.error('That login is already taken')
        return
      }

      /* The password travels with the record and stays readable on the
         supplier's page, so saving simply saves — there is no one-time reveal
         left to hold navigation open for. */
      if (editing) {
        update.mutate(payload, {
          onSuccess: () => {
            toast.success(`${payload.name} saved`)
            navigate(paths.products.supplierDetail(supplierId!))
          },
        })
      } else {
        create.mutate(payload, {
          onSuccess: (supplier) => {
            toast.success(`${supplier.name} added`)
            navigate(paths.products.supplierDetail(supplier.id))
          },
        })
      }
    },
    () => toast.error('Check the highlighted fields'),
  )

  return (
    <form>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={editing ? paths.products.supplierDetail(supplierId!) : paths.products.suppliers}>
          <ArrowLeft />
          {editing ? 'Back to supplier' : 'Suppliers'}
        </Link>
      </Button>

      <PageHeader
        title={editing ? `Edit ${existing?.supplier.name ?? ''}` : 'Add a supplier'}
        description="Who they are and how to reach them. What we owe comes from deliveries and payments."
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(
                  editing ? paths.products.supplierDetail(supplierId!) : paths.products.suppliers,
                )
              }
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={submit}>
              {editing ? 'Save changes' : 'Add supplier'}
            </Button>
          </div>
        }
      />

      <div className="mt-4 max-w-3xl space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required error={form.formState.errors.name?.message}>
              {(p) => <Input {...p} placeholder="AKCHAEV INC" {...form.register('name')} />}
            </Field>
            <Field label="Zone" hint="Country or region, for grouping">
              {(p) => <Input {...p} placeholder="Uzbekistan" {...form.register('zone')} />}
            </Field>
            <Field
              label="Payment terms"
              hint="Days to pay. Leave empty when nothing was agreed — nothing can be overdue without it."
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="paymentTermDays"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      placeholder="30"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Status">
              {(p) => (
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'archived', label: 'Archived' },
                      ]}
                    />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manager</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              hint="The person answerable for this company — who you ring, and who holds the login"
              error={form.formState.errors.contactName?.message}
            >
              {(p) => (
                <Input {...p} placeholder="Rustam Akchaev" {...form.register('contactName')} />
              )}
            </Field>
            <Field label="Phone">
              {(p) => <Input {...p} placeholder="+998 90 123 45 67" {...form.register('phone')} />}
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              {(p) => (
                <Input {...p} placeholder="orders@supplier.com" {...form.register('email')} />
              )}
            </Field>
            <Field label="Address">{(p) => <Input {...p} {...form.register('address')} />}</Field>
            <Field label="Note" className="sm:col-span-2">
              {(p) => (
                <Input
                  {...p}
                  placeholder="Anything worth knowing about this relationship"
                  {...form.register('comment')}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        {/* Handing out an account is its own permission: plenty of people
            should be able to fix a supplier's address without being able to
            create a login to our data. */}
        {can('products.supplierPortal.edit') ? (
          <Card>
            <CardHeader>
              <CardTitle>Supplier portal</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-fg text-sm font-medium">Let their manager sign in</p>
                  <p className="text-fg-subtle text-2xs">
                    They get their own login to the supplier portal, where they see what we order
                    from them. They never see our sales, stock or prices.
                  </p>
                </div>
                <Controller
                  control={form.control}
                  name="access"
                  render={({ field }) => (
                    <Switch
                      aria-label="Let their manager sign in"
                      checked={field.value !== 'none'}
                      onCheckedChange={(on) => {
                        field.onChange(on ? 'granted' : 'none')
                        // A login typed by hand is a login that collides, so
                        // one is proposed from the company name.
                        if (on && !form.getValues('username')) {
                          form.setValue('username', suggestUsername(form.getValues('name')))
                        }
                      }}
                    />
                  )}
                />
              </div>

              {access !== 'none' ? (
                <>
                  <Field
                    label="Password"
                    required
                    hint="Shown in plain text on purpose, so you can read it out or paste it to them"
                    error={form.formState.errors.password?.message}
                  >
                    {(p) => (
                      <div className="flex gap-2">
                        <Input
                          {...p}
                          className="flex-1 font-mono"
                          placeholder="At least 8 characters"
                          {...form.register('password')}
                        />
                        {/* For when you would rather not invent one. */}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            form.setValue('password', generatePassword(), {
                              shouldValidate: true,
                            })
                          }
                        >
                          <Wand2 />
                          Generate
                        </Button>
                      </div>
                    )}
                  </Field>
                  <Field
                    label="Login"
                    required
                    hint="Lowercase, no spaces — it gets read down a phone line"
                    error={form.formState.errors.username?.message}
                  >
                    {(p) => <Input {...p} placeholder="akchaev" {...form.register('username')} />}
                  </Field>
                  <p className="text-fg-subtle text-2xs">
                    Both stay readable on the supplier’s page, so you can look them up when they
                    ring back.
                  </p>
                  {access === 'disabled' ? (
                    <p className="text-warning text-2xs">
                      Sign-in is switched off for this login. Turn it back on from the supplier’s
                      page.
                    </p>
                  ) : null}
                </>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </form>
  )
}
