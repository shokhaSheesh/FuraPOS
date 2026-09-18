import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Field } from '@/shared/components/Field'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { DEMO_PASSWORD } from '../model/auth'
import { t } from '@/shared/i18n'

/**
 * Sign in.
 *
 * Deliberately plain: a login, a password, one button. Anyone opening this is
 * trying to get to work, not to read about the product. The error sits above
 * the button where the eye already is, and says what to do next.
 */
export default function LoginPage() {
  const { user, signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Back to wherever they were sent from, not always the dashboard.
  const from = (location.state as { from?: string } | null)?.from ?? paths.dashboard

  if (user) return <Navigate to={from} replace />

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = signIn(login, password)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-card border-border flex size-14 items-center justify-center border bg-white">
          <img src="/brand/logo-256.png" alt="" width={44} height={44} className="size-11" />
        </span>
        <div>
          <h1 className="text-fg text-xl font-semibold tracking-tight">
            {t('Sign in to Fura Sentr')}
          </h1>
          <p className="text-fg-muted text-sm">{t('Use the login your administrator gave you.')}</p>
        </div>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label={t('Login')}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                autoComplete="username"
                placeholder="akhmet"
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? t('Hide password') : t('Show password')}
                  className="text-fg-subtle hover:text-fg absolute top-1/2 right-2.5 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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

          <Button type="submit" variant="primary" className="w-full">
            <LogIn />
            {t('Sign in')}
          </Button>

          <p className="text-fg-subtle text-2xs text-center">
            {t('Forgotten your password? Ask your administrator to reset it.')}
          </p>
        </form>
      </Card>

      {/* A design build with no backend: say how to get in, rather than leave a
          reviewer guessing at a password. */}
      <p className="text-fg-subtle text-2xs text-center">
        {t('Demo:')} <span className="font-mono">{t('akhmet')}</span> {t('(Owner),')}{' '}
        <span className="font-mono">{t('nodira')}</span> {t('(Manager),')}{' '}
        <span className="font-mono">{t('mansurbek')}</span> {t('(Seller) — password')}{' '}
        <span className="font-mono">{DEMO_PASSWORD}</span>
      </p>
    </div>
  )
}
