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
  const [draft, setDraft] = useState({ name: '', description: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<RoleRow | null>(null)

  const parsed = roleDraftSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openNew = () => {
    setDraft({ name: '', description: '' })
    setShowErrors(false)
    setCreating(true)
  }

  const create = () => {
    setShowErrors(true)
    if (!parsed.success) return
    const role = actions.create(draft)
    setCreating(false)
    toast.success(`${role.name} created — now choose what it can reach`)
    navigate(paths.personnel.roleDetail(role.id))
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
        header: 'Role',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg flex items-center gap-1.5 font-medium">
              {row.original.name}
              {row.original.isSystem ? (
                <Lock className="text-fg-subtle size-3" aria-label="Built in" />
              ) : null}
            </p>
            <p className="text-fg-subtle text-2xs truncate">{row.original.description}</p>
          </div>
        ),
      },
      {
        id: 'holders',
        header: 'People',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) =>
          row.original.holders === 0 ? (
            <span className="text-fg-subtle">Nobody</span>
          ) : (
            <span className="text-fg font-medium tabular-nums">
              {formatNumber(row.original.holders)}
            </span>
          ),
      },
      {
        id: 'access',
        header: 'Access',
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
                {full ? 'Everything' : `${formatNumber(granted)} of ${formatNumber(total)}`}
              </span>
            </div>
          )
        },
      },
      {
        id: 'modules',
        header: 'Can reach',
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
              <span className="text-fg-subtle">Nothing yet</span>
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
                onSelect: () => navigate(paths.personnel.roleDetail(row.original.id)),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(row.original),
                hidden: row.original.isSystem || !can('personnel.roles.delete'),
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
        title="Access & roles"
        description="What each kind of employee can reach. Access is granted to a role, not to a person, so the fifth seller you hire inherits what the other four have and a rule change happens in one place."
        action={
          can('personnel.roles.create') ? (
            <Button variant="primary" onClick={openNew}>
              <Plus />
              Add role
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
        onRowClick={(role) => navigate(paths.personnel.roleDetail(role.id))}
        emptyState={
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="A role is a named set of permissions that people inherit."
          />
        }
      />

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="New role"
        description="Name it after the job, not the person. It starts with no access at all — you choose what it can reach next."
        primary={{ label: 'Create role', onClick: create }}
      >
        <div className="space-y-3">
          <Field label="Name" required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                placeholder="Senior seller"
                value={draft.name}
                onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Description" hint="What this person does, in a line">
            {(p) => (
              <Input
                {...p}
                placeholder="Takes sales and approves discounts"
                value={draft.description}
                onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))}
              />
            )}
          </Field>
        </div>
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
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove(deleting)}
      />
    </>
  )
}
