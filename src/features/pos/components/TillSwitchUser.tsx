import { useMemo, useState } from 'react'
import { ChevronDown, Lock, UserRound } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Popover } from '@/shared/ui/Popover'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { authenticate } from '@/features/auth/model/auth'
import type { Employee } from '@/features/employees/model/employee'
import { useTillStore } from '../model/tillStore'

/** Signing in at the till is a permission of its own — `sales.till.view`. */
const TILL_PERMISSION = 'sales.till.view'

/**
 * Handing the till over (client request).
 *
 * A counter is worked in turns: the seller builds the sale, the cashier takes
 * the money, the owner steps in to fix something. Rather than sign out and in
 * again, the name in the bar opens the others who may work this till — and
 * each of them has to type their own password, because whose name goes on a
 * sale is not something anybody should be able to change by clicking.
 */
export function TillSwitchUser() {
  const employees = useDataStore((s) => s.employees)
  const roles = useDataStore((s) => s.roles)
  const operator = useTillStore((s) => s.operator)
  const locationId = useTillStore((s) => s.locationId)
  const signInTill = useTillStore((s) => s.signInTill)
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState<Employee | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** Who else may stand at this till: this shop's people, and anyone tied to none. */
  const others = useMemo(
    () =>
      employees
        .filter((employee) => employee.status === 'active' && employee.id !== operator?.id)
        .filter((employee) => !employee.locationId || employee.locationId === locationId)
        .filter((employee) => {
          const permissions = roles.find((role) => role.id === employee.roleId)?.permissions ?? []
          return permissions.includes('*') || permissions.includes(TILL_PERMISSION)
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees, roles, operator?.id, locationId],
  )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!asking) return
    const result = authenticate(employees, roles, asking.login, password)
    if (!result.ok) {
      setError(t(result.error))
      return
    }
    const permissions = roles.find((role) => role.id === result.employee.roleId)?.permissions ?? []
    signInTill({
      id: result.employee.id,
      name: result.employee.fullName,
      roleName: result.employee.roleName,
      permissions,
    })
    setAsking(null)
    setPassword('')
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="end"
        className="w-64 p-1"
        trigger={
          <button
            type="button"
            className="hover:bg-surface-muted rounded-control flex items-center gap-2 px-2 py-1 text-left transition-colors"
          >
            <span className="leading-tight">
              <span className="text-fg block text-sm">{operator?.name}</span>
              <span className="text-fg-subtle text-2xs block">{t(operator?.roleName ?? '')}</span>
            </span>
            <ChevronDown className="text-fg-subtle size-4" />
          </button>
        }
      >
        <p className="text-fg-subtle text-2xs px-2 pt-1 pb-1.5">{t('Hand the till over to')}</p>
        {others.map((employee) => (
          <button
            key={employee.id}
            type="button"
            onClick={() => {
              setOpen(false)
              setAsking(employee)
              setPassword('')
              setError(null)
            }}
            className="hover:bg-surface-muted rounded-control flex w-full items-center gap-2.5 px-2 py-1.5 text-left"
          >
            <span className="bg-surface-inset text-fg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="text-fg block truncate text-sm">{employee.fullName}</span>
              <span className="text-fg-subtle text-2xs block truncate">{t(employee.roleName)}</span>
            </span>
          </button>
        ))}
        {others.length === 0 ? (
          <p className="text-fg-subtle px-2 py-3 text-center text-sm">
            {t('Nobody else may work this till.')}
          </p>
        ) : null}
      </Popover>

      <Modal
        open={asking !== null}
        onOpenChange={(next) => (next ? undefined : setAsking(null))}
        title={t('Hand over to {name}', { name: asking?.fullName ?? '' })}
        description={t('Their password, so the sales carry the right name.')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAsking(null)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" form="till-handover" variant="primary">
              <Lock />
              {t('Switch')}
            </Button>
          </div>
        }
      >
        <form id="till-handover" onSubmit={submit} className="space-y-2" noValidate>
          <Input
            autoFocus
            type="password"
            autoComplete="current-password"
            aria-label={t('Password')}
            className={cn('h-11', error && 'border-danger')}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError(null)
            }}
          />
          {error ? (
            <p
              role="alert"
              className="bg-danger-soft text-danger rounded-control px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </form>
      </Modal>
    </>
  )
}
