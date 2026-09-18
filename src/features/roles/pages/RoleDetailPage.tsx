import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Lock, Save, Undo2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { Avatar } from '@/features/employees/components/Avatar'
import { useRole, useRoleActions, useRoleHolders } from '../api/roles'
import { PermissionGrid } from '../components/PermissionGrid'
import { grantedKeys, isFullAccess } from '../model/role'
import { t } from '@/shared/i18n'

/**
 * Editing what a role can reach.
 *
 * Changes are held until Save. A permission grid where every click writes
 * immediately means someone half way through re-scoping a role has, for a few
 * seconds, granted access they were about to take away — and on a screen about
 * access, "for a few seconds" is the wrong amount of time.
 */
export default function RoleDetailPage() {
  const { roleId } = useParams()
  const { can } = useSession()
  const { data: role } = useRole(roleId)
  const holders = useRoleHolders(roleId)
  const actions = useRoleActions()

  const saved = useMemo(() => new Set(role ? grantedKeys(role) : []), [role])
  const [draft, setDraft] = useState<Set<string>>(saved)

  useEffect(() => setDraft(saved), [saved])

  if (!role) {
    return (
      <EmptyState
        title={t('No such role')}
        action={
          <Button variant="secondary" asChild>
            <Link to={paths.users.roles}>{t('Back to roles')}</Link>
          </Button>
        }
      />
    )
  }

  const locked = role.isSystem || !can('users.roles.edit')
  const added = [...draft].filter((key) => !saved.has(key)).length
  const removed = [...saved].filter((key) => !draft.has(key)).length
  const dirty = added > 0 || removed > 0

  const save = () => {
    actions.setPermissions(role.id, [...draft])
    toast.success(
      holders.length
        ? `Saved. ${formatNumber(holders.length)} ${holders.length === 1 ? 'person' : 'people'} affected`
        : 'Saved',
    )
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={paths.users.roles}>
          <ArrowLeft />
          {t('Access & roles')}
        </Link>
      </Button>

      <PageHeader
        title={role.name}
        action={
          locked ? null : (
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button variant="secondary" onClick={() => setDraft(saved)}>
                  <Undo2 />
                  {t('Discard')}
                </Button>
              ) : null}
              <Button variant="primary" onClick={save} disabled={!dirty}>
                <Save />
                {t('Save changes')}
              </Button>
            </div>
          )
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            {role.isSystem ? (
              <Badge tone="warning">
                <Lock className="size-3" />
                {t('Built in')}
              </Badge>
            ) : null}
            <span className="text-fg-muted text-sm">
              {isFullAccess(role)
                ? t('Everything, including modules added later')
                : t('{p0} of {p1} permissions', {
                    p0: formatNumber(draft.size),
                    p1: formatNumber(role.total),
                  })}
            </span>
            {dirty ? (
              <span className="text-warning text-2xs">
                {t('· unsaved:')} {added ? `+${formatNumber(added)}` : ''}
                {added && removed ? ' ' : ''}
                {removed ? `−${formatNumber(removed)}` : ''}
              </span>
            ) : null}
          </div>
        }
      />

      {role.isSystem ? (
        <Card className="border-warning/40">
          <CardBody className="text-fg-muted text-sm">
            <span className="text-fg font-medium">{t('This role cannot be changed.')}</span>{' '}
            {t(
              'It is the way back in when something else is mis-configured — a product where every administrator can be locked out is a product that eventually locks everyone out. It also picks up any module added in future automatically.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('Permissions')}</CardTitle>
          </CardHeader>
          <CardBody>
            <PermissionGrid granted={draft} onChange={setDraft} readOnly={locked} />
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t('Who holds it')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {holders.length === 0 ? (
              <p className="text-fg-subtle text-sm">
                {t('Nobody has this role yet, so a change here affects no one.')}
              </p>
            ) : (
              <>
                <p className="text-fg-subtle text-2xs">
                  {holders.length === 1
                    ? t('Saving changes what this person sees.')
                    : t('Saving changes what these {length} people see.', {
                        length: holders.length,
                      })}
                </p>
                {holders.map((employee) => (
                  <Link
                    key={employee.id}
                    to={paths.users.employeeDetail(employee.id)}
                    className="hover:bg-surface-inset -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5"
                  >
                    <Avatar name={employee.fullName} src={employee.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="text-fg truncate text-sm">{employee.fullName}</p>
                      <p className="text-fg-subtle text-2xs truncate">
                        {employee.locationName ?? t('All locations')}
                      </p>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
