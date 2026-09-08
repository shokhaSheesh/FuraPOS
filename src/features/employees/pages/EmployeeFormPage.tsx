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
import { DatePicker } from '@/shared/ui/DatePicker'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useDataStore } from '@/data/store'
import { useEmployee, useEmployeeActions } from '../api/employees'
import { EMPLOYEE_STATUSES, employeeDraftSchema, type EmployeeDraft } from '../model/employee'

/**
 * Adding or editing a person.
 *
 * Role and location come before contact details, because they are the fields
 * that decide what this account can actually do — a phone number changes
 * nothing, and a role change hands someone the stock ledger.
 */
export default function EmployeeFormPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const roles = useDataStore((s) => s.roles)
  const locations = useDataStore((s) => s.locations)
  const { data: existing } = useEmployee(employeeId)
  const actions = useEmployeeActions()
  const editing = Boolean(employeeId)

  const form = useForm<EmployeeDraft>({
    resolver: zodResolver(employeeDraftSchema),
    defaultValues: existing
      ? {
          fullName: existing.fullName,
          phone: existing.phone,
          email: existing.email,
          roleId: existing.roleId,
          locationId: existing.locationId,
          status: existing.status,
          hiredAt: existing.hiredAt,
          salary: existing.salary,
          comment: existing.comment,
        }
      : {
          fullName: '',
          phone: '',
          email: '',
          roleId: '',
          locationId: locations[0]?.id ?? null,
          status: 'active',
          hiredAt: new Date().toISOString(),
          salary: null,
          comment: '',
        },
  })

  if (editing && !existing) {
    return (
      <EmptyState
        title="No such employee"
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.personnel.employees}>Back to employees</Link>
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
        comment: values.comment || null,
      }
      if (editing && existing) {
        actions.update(existing.id, input)
        toast.success('Saved')
        navigate(paths.personnel.employeeDetail(existing.id))
      } else {
        const created = actions.create(input)
        toast.success(`${created.fullName} added as ${created.roleName}`)
        navigate(paths.personnel.employeeDetail(created.id))
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
              ? paths.personnel.employeeDetail(existing.id)
              : paths.personnel.employees
          }
        >
          <ArrowLeft />
          {editing && existing ? existing.fullName : 'Employees'}
        </Link>
      </Button>

      <PageHeader
        title={editing ? 'Edit employee' : 'Add employee'}
        description="A person's role decides what they can reach in the system. Their sales are attributed to them from the moment the account exists."
        action={
          <Button type="submit" variant="primary">
            <Save />
            {editing ? 'Save changes' : 'Add employee'}
          </Button>
        }
      />

      <div className="mt-4 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Field label="Role" required error={form.formState.errors.roleId?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      placeholder="Pick a role"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      options={roles.map((role) => ({ value: role.id, label: role.name }))}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Works at"
              hint="Leave empty for someone who covers every location"
              error={form.formState.errors.locationId?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      placeholder="All locations"
                      value={field.value ?? undefined}
                      onChange={(value) => field.onChange(value || null)}
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
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
                      options={EMPLOYEE_STATUSES.map((entry) => ({
                        value: entry.value,
                        label: entry.label,
                      }))}
                    />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Person</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={form.formState.errors.fullName?.message}>
              {(p) => <Input {...p} placeholder="Nodira Rasulova" {...form.register('fullName')} />}
            </Field>
            <Field label="Phone">
              {(p) => <Input {...p} placeholder="+998 90 123-45-67" {...form.register('phone')} />}
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              {(p) => <Input {...p} placeholder="nodira@fura.uz" {...form.register('email')} />}
            </Field>
            <Field label="Hired">
              {() => (
                <Controller
                  control={form.control}
                  name="hiredAt"
                  render={({ field }) => (
                    <DatePicker
                      className="w-full"
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange((date ?? new Date()).toISOString())}
                    />
                  )}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pay</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Base pay"
              hint="Per month, before anything Seller motivation adds"
              error={form.formState.errors.salary?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      min={0}
                      placeholder="Not set"
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
