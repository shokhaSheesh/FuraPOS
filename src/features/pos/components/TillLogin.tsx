import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Logo } from '@/shared/ui/Logo'
import { Field } from '@/shared/components/Field'
import { paths } from '@/shared/config/paths'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { authenticate } from '@/features/auth/model/auth'
import { useTillStore } from '../model/tillStore'

/** Signing in at the till is a permission of its own — `sales.till.view`. */
const TILL_PERMISSION = 'sales.till.view'

/**
 * The till's sign-in (client request): a login and a password, nothing else.
 * It is not the back office's session — whoever stands at this counter signs
 * in here, their name goes on every sale they ring up, and the till locks
 * again when they leave. Only a role allowed at the till gets in.
 */
export function TillLogin() {
  const employees = useDataStore((s) => s.employees)
  const roles = useDataStore((s) => s.roles)
  const signInTill = useTillStore((s) => s.signInTill)
  const setLocation = useTillStore((s) => s.setLocation)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = authenticate(employees, roles, login, password)
    if (!result.ok) {
      setError(t(result.error))
      return
    }
    const role = roles.find((entry) => entry.id === result.employee.roleId)
    const permissions = role?.permissions ?? []
    if (!permissions.includes('*') && !permissions.includes(TILL_PERMISSION)) {
      setError(t('This account may not work at the till.'))
      return
    }
    // The till stands in the shop they belong to.
    if (result.employee.locationId) setLocation(result.employee.locationId)
    signInTill({
      id: result.employee.id,
      name: result.employee.fullName,
      roleName: result.employee.roleName,
      permissions,
    })
  }

  return (
    <div className="bg-canvas flex h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h1 className="text-fg text-xl font-semibold">{t('Sign in to the till')}</h1>
      </div>

      <Card className="w-full max-w-sm p-5">
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label={t('Login')}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                autoComplete="username"
                className="h-11"
                value={login}
                onChange={(event) => {
                  setLogin(event.target.value)
                  setError(null)
                }}
              />
            )}
          </Field>

          <Field label={t('Password')}>
            {(p) => (
              <div className="relative">
                <Input
                  {...p}
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
              </div>
            )}
          </Field>

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
