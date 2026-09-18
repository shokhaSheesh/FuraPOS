import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Lock, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { RowActions } from '@/shared/components/RowActions'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { Input } from '@/shared/ui/Input'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Field } from '@/shared/components/Field'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useRoleActions, useRoles, type RoleRow } from '../api/roles'
import { roleDraftSchema } from '../model/role'
import { t } from '@/shared/i18n'

/**
 * Access & roles.
 *
 * Widest access first, because a list about who can do what should open on the
 * roles that can do the most. The column that matters is **how many people
 * hold it** — a permission change is abstract until it has a number of people
 * attached to it.
 */
export default function RolesPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { data, isLoading } = useRoles()
  const actions = useRoleActions()

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<RoleRow | null>(null)

  const parsed = roleDraftSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openNew = () => {
    setDraft({ name: '' })
    setShowErrors(false)
    setCreating(true)
  }

  const create = () => {
    setShowErrors(true)
    if (!parsed.success) return
    const role = actions.create(draft)
    setCreating(false)
    toast.success(`${role.name} created — now choose what it can reach`)
    navigate(paths.users.roleDetail(role.id))
  }

  const remove = (role: RoleRow) => {
    const result = actions.remove(role.id)
    setDeleting(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${role.name} deleted`)
  }

  const columns = useMemo<TableColumn<RoleRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Role'),
        enableHiding: false,
        cell: ({ row }) => (
          <p className="text-fg flex items-center gap-1.5 font-medium">
            {row.original.name}
            {row.original.isSystem ? (
              <Lock className="text-fg-subtle size-3" aria-label={t('Built in')} />
            ) : null}
          </p>
        ),
      },
      {
        id: 'holders',
        header: t('People'),
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) =>
          row.original.holders === 0 ? (
            <span className="text-fg-subtle">{t('Nobody')}</span>
          ) : (
            <span className="text-fg font-medium tabular-nums">
              {formatNumber(row.original.holders)}
            </span>
          ),
      },
      {
        id: 'access',
        header: t('Access'),
        enableHiding: false,
        cell: ({ row }) => {
          const { granted, total, ratio, permissions } = row.original
          const full = permissions.includes('*')
          return (
            <div className="flex items-center gap-2">
              <span className="bg-surface-inset h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
                <span
                  className={`block h-full rounded-full ${full ? 'bg-warning' : 'bg-info'}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </span>
              <span className="text-fg-muted text-2xs tabular-nums">
                {full ? t('Everything') : `${formatNumber(granted)} of ${formatNumber(total)}`}
              </span>
            </div>
          )
        },
      },
      {
        id: 'modules',
        header: t('Can reach'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.modules.slice(0, 4).map((label) => (
              <Badge key={label} tone="neutral">
                {label}
              </Badge>
            ))}
            {row.original.modules.length > 4 ? (
              <span className="text-fg-subtle text-2xs">
                +{row.original.modules.length - 4} more
              </span>
            ) : null}
            {row.original.modules.length === 0 ? (
              <span className="text-fg-subtle">{t('Nothing yet')}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: row.original.isSystem ? 'View permissions' : 'Edit permissions',
                icon: Pencil,
                onSelect: () => navigate(paths.users.roleDetail(row.original.id)),
              },
              {
                label: t('Delete'),
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(row.original),
                hidden: row.original.isSystem || !can('users.roles.delete'),
              },
            ]}
          />
        ),
      },
    ],
    [can, navigate],
  )

  return (
    <>
      <PageHeader
        title={t('Access & roles')}
        description={t(
          'What each kind of employee can reach. Access is granted to a role, not to a person, so the fifth seller you hire inherits what the other four have and a rule change happens in one place.',
        )}
        action={
          can('users.roles.create') ? (
            <Button variant="primary" onClick={openNew}>
              <Plus />
              {t('Add role')}
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey="roles"
        columns={columns}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        pagination={{ page: 1, pageSize: 25 }}
        onPaginationChange={() => {}}
        onRowClick={(role) => navigate(paths.users.roleDetail(role.id))}
        emptyState={
          <EmptyState
            icon={ShieldCheck}
            title={t('No roles yet')}
            description={t('A role is a named set of permissions that people inherit.')}
          />
        }
      />

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title={t('New role')}
        description={t(
          'Name it after the job, not the person. It starts with no access at all — you choose what it can reach next.',
        )}
        primary={{ label: t('Create role'), onClick: create }}
      >
        <Field label={t('Name')} required error={errors.name?.[0]}>
          {(p) => (
            <Input
              {...p}
              placeholder={t('Senior seller')}
              value={draft.name}
              onChange={(e) => setDraft({ name: e.target.value })}
            />
          )}
        </Field>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete the ${deleting?.name} role?`}
        body={
          deleting?.holders
            ? `${formatNumber(deleting.holders)} ${deleting.holders === 1 ? 'person holds' : 'people hold'} this role. Move them to another role first — otherwise they would be left holding a role that does not exist.`
            : 'Nobody holds this role, so nothing changes for anyone.'
        }
        confirmLabel={t('Delete')}
        destructive
        onConfirm={() => deleting && remove(deleting)}
      />
    </>
  )
}
