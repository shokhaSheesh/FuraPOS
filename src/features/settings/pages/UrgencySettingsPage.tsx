import { useMemo, useState } from 'react'
import { Flame, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { URGENCY_TONES, urgencyLevelSchema, type UrgencyLevel } from '../model/settings'

/**
 * Urgency levels — «Zarurlik darajasi».
 *
 * The words a China order uses to tell a factory what to make first. Kept as
 * a reference list because the business decides how many levels there are and
 * what they are called; the order screen and the PDF only read it. Sorted by
 * rank, which is also the order a factory sees the lines in.
 */
export default function UrgencySettingsPage() {
  const { can } = useSession()
  const levels = useDataStore((s) => s.urgencyLevels)
  const orders = useDataStore((s) => s.orders)
  const create = useDataStore((s) => s.createUrgencyLevel)
  const update = useDataStore((s) => s.updateUrgencyLevel)
  const remove = useDataStore((s) => s.deleteUrgencyLevel)

  const [editing, setEditing] = useState<UrgencyLevel | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Omit<UrgencyLevel, 'id'>>({
    name: '',
    tone: 'info',
    rank: 1,
  })
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<UrgencyLevel | null>(null)

  const sorted = useMemo(() => [...levels].sort((a, b) => a.rank - b.rank), [levels])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of orders) {
      for (const line of order.lines) {
        if (line.urgencyId) map.set(line.urgencyId, (map.get(line.urgencyId) ?? 0) + 1)
      }
    }
    return map
  }, [orders])

  const parsed = urgencyLevelSchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (level: UrgencyLevel | null) => {
    setEditing(level)
    setDraft(
      level
        ? { name: level.name, tone: level.tone, rank: level.rank }
        : { name: '', tone: 'info', rank: (sorted.at(-1)?.rank ?? 0) + 1 },
    )
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    if (editing) update(editing.id, parsed.data)
    else create(parsed.data)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${parsed.data.name} added`)
  }

  const columns = useMemo<TableColumn<UrgencyLevel>[]>(
    () => [
      {
        accessorKey: 'rank',
        header: 'Order',
        enableHiding: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.rank}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Level',
        enableHiding: false,
        cell: ({ row }) => <Badge tone={row.original.tone}>{row.original.name}</Badge>,
      },
      {
        id: 'used',
        header: 'Order lines',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const used = counts.get(row.original.id) ?? 0
          return used === 0 ? (
            <span className="text-fg-subtle">None</span>
          ) : (
            <span className="tabular-nums">{formatNumber(used)}</span>
          )
        },
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
                hidden: !can('settings.products.edit'),
                onSelect: () => openFor(row.original),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                hidden: !can('settings.products.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, counts],
  )

  return (
    <>
      <PageHeader
        title="Urgency levels"
        description="How badly a line on a China order is needed. The factory reads them on the PDF, in this order."
        action={
          can('settings.products.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              Add level
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey="settings-urgency"
        columns={columns}
        data={sorted}
        total={sorted.length}
        isLoading={false}
        pagination={{ page: 1, pageSize: 50 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            icon={Flame}
            title="No urgency levels yet"
            description="Add the levels your China orders use, such as Critical, High and Normal."
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : 'New urgency level'}
        primary={{ label: editing ? 'Save changes' : 'Add level', onClick: save }}
      >
        <div className="space-y-3">
          <Field label="Name" required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                placeholder="Critical"
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Colour">
              {(p) => (
                <Select
                  {...p}
                  className="w-full"
                  value={draft.tone}
                  onChange={(tone) => setDraft((c) => ({ ...c, tone }))}
                  options={URGENCY_TONES}
                />
              )}
            </Field>
            <Field label="Order" required hint="1 is the most urgent" error={errors.rank?.[0]}>
              {(p) => (
                <NumberField
                  {...p}
                  className="w-full"
                  nullable={false}
                  min={1}
                  value={draft.rank}
                  onChange={(rank) => setDraft((c) => ({ ...c, rank: rank ?? 1 }))}
                />
              )}
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="Only a level no order line uses can be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          const result = remove(deleting.id)
          setDeleting(null)
          if (result.ok) toast.success('Level deleted')
          else toast.error(result.error)
        }}
      />
    </>
  )
}
