import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Field } from '@/shared/components/Field'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { useCashRegisters, useRegisterActions } from '../api/shifts'
import { registerSchema, type CashRegister, type RegisterDraft } from '../model/shift'

/**
 * Cash registers.
 *
 * A register is a drawer at a location — the thing a shift is opened on. OX
 * keeps its cash terminals under Settings → Продажи; this is the same idea
 * without the terminal hardware, which this product does not talk to.
 */
export default function RegistersSettingsPage() {
  const { can } = useSession()
  const { data: registers } = useCashRegisters()
  const locations = useDataStore((s) => s.locations)
  const shifts = useDataStore((s) => s.cashShifts)
  const actions = useRegisterActions()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CashRegister | null>(null)
  const [deleting, setDeleting] = useState<CashRegister | null>(null)
  const [draft, setDraft] = useState<RegisterDraft>({ name: '', locationId: '', active: true })
  const [showErrors, setShowErrors] = useState(false)

  const parsed = registerSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (register: CashRegister | null) => {
    setEditing(register)
    setDraft({
      name: register?.name ?? '',
      locationId: register?.locationId ?? '',
      active: register?.active ?? true,
    })
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    if (editing) actions.update(editing.id, parsed.data)
    else actions.create(parsed.data)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${draft.name} added`)
  }

  const columns = useMemo<TableColumn<CashRegister>[]>(
    () => [
      { accessorKey: 'name', header: 'Register', enableHiding: false },
      { accessorKey: 'locationName', header: 'Location' },
      {
        id: 'shifts',
        header: 'Shifts',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const count = shifts.filter((shift) => shift.registerId === row.original.id).length
          return count === 0 ? (
            <span className="text-fg-subtle">None yet</span>
          ) : (
            <span className="tabular-nums">{count}</span>
          )
        },
      },
      {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={row.original.active ? 'success' : 'neutral'}>
            {row.original.active ? 'In use' : 'Retired'}
          </Badge>
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
                label: 'Edit',
                icon: Pencil,
                hidden: !can('settings.registers.edit'),
                onSelect: () => openFor(row.original),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                hidden: !can('settings.registers.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, shifts],
  )

  return (
    <>
      <PageHeader
        title="Cash registers"
        description="The drawers a shift can be opened on. One per counter, not one per person."
        action={
          can('settings.registers.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              Add register
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey="settings-registers"
        columns={columns}
        data={registers}
        total={registers.length}
        isLoading={false}
        pagination={{ page: 1, pageSize: 50 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            icon={Wallet}
            title="No registers yet"
            description="Add one per counter. A cash shift is opened on a register, and a cash sale needs an open shift."
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : 'New register'}
        primary={{ label: editing ? 'Save changes' : 'Add register', onClick: save }}
      >
        <div className="space-y-3">
          <Field label="Name" required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                placeholder="Main desk"
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Location" required error={errors.locationId?.[0]}>
            {(p) => (
              <Select
                {...p}
                className="w-full"
                placeholder="Choose a location"
                value={draft.locationId || undefined}
                onChange={(locationId) => setDraft((c) => ({ ...c, locationId }))}
                options={locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                }))}
              />
            )}
          </Field>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="text-fg block text-sm font-medium">In use</span>
              <span className="text-fg-subtle text-2xs">
                A retired register keeps its history but cannot be opened again.
              </span>
            </span>
            <Switch
              aria-label="In use"
              checked={draft.active}
              onCheckedChange={(active) => setDraft((c) => ({ ...c, active }))}
            />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="A register with shifts against it cannot be deleted — those shifts are the record of who had the cash. Retire it instead."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          const result = actions.remove(deleting.id)
          setDeleting(null)
          if (result.ok) toast.success('Register deleted')
          else toast.error(result.error)
        }}
      />
    </>
  )
}
