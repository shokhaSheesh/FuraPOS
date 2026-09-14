import { Link, useNavigate, useParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, Wand2 } from 'lucide-react'
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
import { generatePassword } from '@/shared/lib/password'
import {
  EMPLOYEE_STATUSES,
  employeeDraftSchema,
  isLoginTaken,
  suggestLogin,
  type EmployeeDraft,
} from '../model/employee'

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
  const employees = useDataStore((s) => s.employees)
  const { data: existing } = useEmployee(employeeId)
  const actions = useEmployeeActions()
  const editing = Boolean(employeeId)

  const form = useForm<EmployeeDraft>({
    resolver: zodResolver(employeeDraftSchema),
    defaultValues: existing
      ? {
          fullName: existing.fullName,
          login: existing.login,
          password: existing.password,
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
          login: '',
          // A password is there from the start, so adding someone is never
          // blocked on inventing one.
          password: generatePassword(),
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
      // Two people signing in as one name would be one account for two people,
      // and the schema cannot see the other employees to catch it.
      if (isLoginTaken(employees, values.login, existing?.id)) {
        form.setError('login', { message: 'Someone else already signs in with this login' })
        toast.error('That login is already taken')
        return
      }
      const input = {
        ...values,
        login: values.login.trim().toLowerCase(),
        password: values.password.trim(),
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

        {/* How they get into the platform. Right after Access, because a role
            is only useful to someone who can sign in to use it. */}
        <Card>
          <CardHeader className="flex-col items-stretch gap-1">
            <CardTitle>Sign-in</CardTitle>
            <p className="text-fg-subtle text-2xs">
              What they type on the sign-in page. The password is shown so you can pass it on;
              change it here whenever it needs resetting.
            </p>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Login"
              required
              hint="Lowercase, no spaces"
              error={form.formState.errors.login?.message}
            >
              {(p) => <Input {...p} placeholder="nodira" {...form.register('login')} />}
            </Field>
            <Field label="Password" required error={form.formState.errors.password?.message}>
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} className="flex-1 font-mono" {...form.register('password')} />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      form.setValue('password', generatePassword(), { shouldValidate: true })
                    }
                  >
                    <Wand2 />
                    Generate
                  </Button>
                </div>
              )}
            </Field>
            {existing?.status && existing.status !== 'active' ? (
              <p className="text-warning text-2xs sm:col-span-2">
                This account is {existing.status}, so it cannot sign in whatever the password is.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Person</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={form.formState.errors.fullName?.message}>
              {(p) => (
                <Input
                  {...p}
                  placeholder="Nodira Rasulova"
                  {...form.register('fullName', {
                    // Propose a login from the first name the first time one is typed.
                    onBlur: (event) => {
                      if (!form.getValues('login')) {
                        form.setValue('login', suggestLogin(event.target.value))
                      }
                    },
                  })}
                />
              )}
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
            <Field label="Base pay" hint="Per month" error={form.formState.errors.salary?.message}>
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
