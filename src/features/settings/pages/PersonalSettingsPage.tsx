import { useState } from 'react'
import { Save } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { useDataStore } from '@/data/store'
import { Avatar } from '@/features/employees/components/Avatar'
import { t } from '@/shared/i18n'

/**
 * Personal data: who you are.
 *
 * Notification preferences lived here too, set per event and per channel, and
 * were cut at the client's request.
 */
export default function PersonalSettingsPage() {
  const { user } = useSession()
  const employees = useDataStore((s) => s.employees)

  const me = employees.find((employee) => employee.id === user?.id)
  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: me?.phone ?? '',
  })

  return (
    <>
      <PageHeader title={t('Personal data')} description={t('Your own details.')} />

      <Card>
        <CardHeader className="flex items-center justify-start gap-3">
          <Avatar name={profile.name} src={user?.avatarUrl} size="lg" />
          <div className="min-w-0">
            <CardTitle>{profile.name}</CardTitle>
            <p className="text-fg-subtle text-2xs">
              {user?.role.name} · {me?.locationName ?? t('All locations')}
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Name')}>
              {(p) => (
                <Input
                  {...p}
                  value={profile.name}
                  onChange={(e) => setProfile((c) => ({ ...c, name: e.target.value }))}
                />
              )}
            </Field>
            <Field label={t('Phone')}>
              {(p) => (
                <Input
                  {...p}
                  value={profile.phone}
                  onChange={(e) => setProfile((c) => ({ ...c, phone: e.target.value }))}
                />
              )}
            </Field>
            <Field label={t('Email')}>
              {(p) => (
                <Input
                  {...p}
                  value={profile.email}
                  onChange={(e) => setProfile((c) => ({ ...c, email: e.target.value }))}
                />
              )}
            </Field>
            <Field label={t('Role')} hint={t('Changed in Access & roles, not here')}>
              {(p) => <Input {...p} value={user?.role.name ?? ''} disabled />}
            </Field>
          </div>
          <Button variant="primary" onClick={() => toast.success(t('Saved'))}>
            <Save />
            {t('Save changes')}
          </Button>
        </CardBody>
      </Card>
    </>
  )
}
