import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Eye, EyeOff, LogIn, MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Logo } from '@/shared/ui/Logo'
import { cn } from '@/shared/lib/cn'
import { paths } from '@/shared/config/paths'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { authenticate } from '@/features/auth/model/auth'
import { useTillStore } from '../model/tillStore'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

/**
 * The till's own sign-in (client request). Whoever is at the counter taps
 * their name and types their password; their name then goes on every sale,
 * and «Выйти» locks the till for the next person. Only the staff of this shop
 * who may sell are offered, so a shared till is two taps and a password.
 */
export function TillLogin({ locationId }: { locationId: string }) {
  const employees = useDataStore((s) => s.employees)
  const roles = useDataStore((s) => s.roles)
  const locations = useDataStore((s) => s.locations)
  const signInTill = useTillStore((s) => s.signInTill)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const staff = useMemo(
    () =>
      employees
        .filter((employee) => employee.status === 'active')
        // This shop's people, and those tied to no shop (the owner).
        .filter((employee) => !employee.locationId || employee.locationId === locationId)
        .filter((employee) => {
          const role = roles.find((entry) => entry.id === employee.roleId)
          return (
            role?.permissions.includes('*') || role?.permissions.includes('sales.orders.create')
          )
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees, roles, locationId],
  )
  const chosen = staff.find((employee) => employee.id === chosenId) ?? null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!chosen) return
    const result = authenticate(employees, roles, chosen.login, password)
    if (!result.ok) {
      setError(t(result.error))
      return
    }
    const role = roles.find((entry) => entry.id === result.employee.roleId)
    signInTill({
      id: result.employee.id,
      name: result.employee.fullName,
      roleName: result.employee.roleName,
      permissions: role?.permissions ?? [],
    })
  }

  return (
    <div className="bg-canvas flex h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo />
        <h1 className="text-fg mt-2 text-xl font-semibold">{t('Sign in to the till')}</h1>
        <p className="text-fg-muted flex items-center gap-1.5 text-sm">
          <MapPin className="size-4" />
          {locations.find((location) => location.id === locationId)?.name}
        </p>
      </div>

      <Card className="w-full max-w-xl space-y-4 p-5">
        <div>
          <p className="text-fg-muted mb-2 text-sm">{t('Who is at the till?')}</p>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {staff.map((employee) => {
              const selected = employee.id === chosenId
              return (
                <button
                  key={employee.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setChosenId(employee.id)
                    setPassword('')
                    setError(null)
                  }}
                  className={cn(
                    'rounded-card flex items-center gap-2.5 border p-2.5 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary-soft/50'
                      : 'border-border hover:border-border-strong',
                  )}
                >
                  {employee.avatarUrl ? (
                    <img
                      src={employee.avatarUrl}
                      alt=""
                      className="size-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                        selected ? 'bg-primary text-primary-fg' : 'bg-surface-inset text-fg-muted',
                      )}
                    >
                      {initials(employee.fullName)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="text-fg block truncate text-sm font-medium">
                      {employee.fullName}
                    </span>
                    <span className="text-fg-subtle text-2xs block truncate">
                      {t(employee.roleName)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          {staff.length === 0 ? (
            <p className="text-fg-subtle py-4 text-center text-sm">
              {t('Nobody at this shop may sell. Give someone a role that can, in Access & roles.')}
            </p>
          ) : null}
        </div>

        {chosen ? (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <label className="block space-y-1">
              <span className="text-fg-muted text-sm">
                {t('Password for {name}', { name: chosen.fullName })}
              </span>
              <span className="relative block">
                <Input
                  autoFocus
                  type={shown ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShown((value) => !value)}
                  aria-label={shown ? t('Hide password') : t('Show password')}
                  className="text-fg-subtle hover:text-fg absolute top-1/2 right-3 -translate-y-1/2"
                >
                  {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            {error ? (
              <p
                role="alert"
                className="bg-danger-soft text-danger rounded-control px-3 py-2 text-sm"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" size="lg" className="w-full">
              <LogIn />
              {t('Open the till')}
            </Button>
          </form>
        ) : null}
      </Card>

      <Link
        to={paths.dashboard}
        className="text-fg-muted hover:text-fg flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('Back office')}
      </Link>
    </div>
  )
}
