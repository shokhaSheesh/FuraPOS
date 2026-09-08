import { Link, useNavigate, useParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useClient, useClientActions } from '../api/clients'
import { CLIENT_STATUSES, CLIENT_TYPES, clientDraftSchema, type ClientDraft } from '../model/client'

/**
 * Adding or editing a client.
 *
 * The credit limit is the field that does something: it is what a sale on
 * account is checked against. Everything else is contact detail.
 */
export default function ClientFormPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { data: existing } = useClient(clientId)
  const actions = useClientActions()
  const editing = Boolean(clientId)

  const form = useForm<ClientDraft>({
    resolver: zodResolver(clientDraftSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          type: existing.type,
          phone: existing.phone,
          email: existing.email,
          address: existing.address,
          creditLimit: existing.creditLimit,
          status: existing.status,
          comment: existing.comment,
        }
      : {
          name: '',
          type: 'business',
          phone: '',
          email: '',
          address: '',
          creditLimit: null,
          status: 'active',
          comment: '',
        },
  })

  const type = form.watch('type')

  if (editing && !existing) {
    return (
      <EmptyState
        title="No such client"
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.marketing.clients}>Back to clients</Link>
          </Button>
        }
      />
    )
  }

  const submit = form.handleSubmit(
    (values) => {
      const input = {
        ...values,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        comment: values.comment || null,
      }
      if (editing && existing) {
        actions.update(existing.id, input)
        toast.success('Saved')
        navigate(paths.marketing.clientDetail(existing.id))
      } else {
        const created = actions.create(input)
        toast.success(`${created.name} added`)
        navigate(paths.marketing.clientDetail(created.id))
      }
    },
    () => toast.error('Check the highlighted fields'),
  )

  return (
    <form onSubmit={submit}>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link
          to={
            editing && existing
              ? paths.marketing.clientDetail(existing.id)
              : paths.marketing.clients
          }
        >
          <ArrowLeft />
          {editing && existing ? existing.name : 'Clients'}
        </Link>
      </Button>

      <PageHeader
        title={editing ? 'Edit client' : 'Add client'}
        description="A client can be given an account, which lets a sale be put on credit instead of paid up front."
        action={
          <Button type="submit" variant="primary">
            <Save />
            {editing ? 'Save changes' : 'Add client'}
          </Button>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Who they are</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              {() => (
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <SegmentedControl
                      aria-label="Client type"
                      value={field.value}
                      onChange={field.onChange}
                      options={CLIENT_TYPES.map((entry) => ({
                        value: entry.value,
                        label: entry.label,
                      }))}
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
                      options={CLIENT_STATUSES.map((entry) => ({
                        value: entry.value,
                        label: entry.label,
                      }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Name" required error={form.formState.errors.name?.message}>
              {(p) => (
                <Input
                  {...p}
                  placeholder={type === 'business' ? 'ООО "Транс Логистик"' : 'Бекзод Рахимов'}
                  {...form.register('name')}
                />
              )}
            </Field>
            <Field label="Phone">
              {(p) => <Input {...p} placeholder="+998 90 123 45 67" {...form.register('phone')} />}
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              {(p) => <Input {...p} placeholder="info@example.uz" {...form.register('email')} />}
            </Field>
            <Field label="Address">
              {(p) => <Input {...p} placeholder="Ташкент, ул. …" {...form.register('address')} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Credit limit"
              hint="How much they may owe at once. Leave empty for someone who pays up front."
              error={form.formState.errors.creditLimit?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      min={0}
                      placeholder="No account"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Note">
              {(p) => (
                <Input {...p} placeholder="Anything worth knowing" {...form.register('comment')} />
              )}
            </Field>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
