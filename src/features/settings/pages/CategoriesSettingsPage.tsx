import { useMemo, useState } from 'react'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { categorySchema, type CategorySettings } from '../model/settings'

interface Row extends CategorySettings {
  depth: number
  products: number
  parentName: string | null
}

/**
 * Product categories.
 *
 * Two levels, flattened into an indented list rather than a collapsing tree:
 * with six categories a tree is ceremony, and an indented table can still be
 * sorted, searched and counted.
 *
 * This is the only part of OX's Продукты settings kept. The rest of that tab
 * is custom property builders — variation properties, product properties,
 * receipt properties — which CLAUDE.md rules out: the attributes that matter
 * here are real typed fields, not a builder.
 */
export default function CategoriesSettingsPage() {
  const { can } = useSession()
  const categories = useDataStore((s) => s.categorySettings)
  const variations = useDataStore((s) => s.variations)
  const create = useDataStore((s) => s.createCategory)
  const update = useDataStore((s) => s.updateCategory)
  const remove = useDataStore((s) => s.deleteCategory)

  const [editing, setEditing] = useState<CategorySettings | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', parentId: null as string | null })
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(() => {
    const counts = new Map<string, number>()
    for (const variation of variations) {
      counts.set(variation.categoryId, (counts.get(variation.categoryId) ?? 0) + 1)
    }
    const byId = new Map(categories.map((category) => [category.id, category]))
    const parents = categories.filter((category) => category.parentId === null)

    // Parents first, each followed by its children — the shape of the tree,
    // read top to bottom.
    return parents.flatMap((parent) => [
      { ...parent, depth: 0, products: counts.get(parent.id) ?? 0, parentName: null },
      ...categories
        .filter((category) => category.parentId === parent.id)
        .map((child) => ({
          ...child,
          depth: 1,
          products: counts.get(child.id) ?? 0,
          parentName: byId.get(child.parentId!)?.name ?? null,
        })),
    ])
  }, [categories, variations])

  const parsed = categorySchema.safeParse(draft)
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (category: CategorySettings | null) => {
    setEditing(category)
    setDraft({ name: category?.name ?? '', parentId: category?.parentId ?? null })
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success) return
    if (editing) update(editing.id, draft)
    else create(draft)
    setOpen(false)
    toast.success(editing ? 'Saved' : `${draft.name} added`)
  }

  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Category',
        enableHiding: false,
        cell: ({ row }) => (
          <span
            className={row.original.depth === 0 ? 'text-fg font-medium' : 'text-fg-muted'}
            style={{ paddingLeft: row.original.depth * 20 }}
          >
            {row.original.name}
          </span>
        ),
      },
      {
        id: 'level',
        header: 'Level',
        cell: ({ row }) => (
          <Badge tone="neutral">{row.original.depth === 0 ? 'Group' : 'Category'}</Badge>
        ),
      },
      {
        id: 'products',
        header: 'Products',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) =>
          row.original.products === 0 ? (
            <span className="text-fg-subtle">None</span>
          ) : (
            <span className="tabular-nums">{formatNumber(row.original.products)}</span>
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
    [can],
  )

  const parentOptions = categories
    .filter((category) => category.parentId === null && category.id !== editing?.id)
    .map((category) => ({ value: category.id, label: category.name }))

  return (
    <>
      <PageHeader
        title="Categories"
        description="How the catalogue is grouped. Two levels: a group, and the categories inside it. Every product sits in one."
        action={
          can('settings.products.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              Add category
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey="settings-categories"
        columns={columns}
        data={rows}
        total={rows.length}
        isLoading={false}
        pagination={{ page: 1, pageSize: 100 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Group the catalogue so it can be filtered and reported on."
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        primary={{ label: editing ? 'Save changes' : 'Add category', onClick: save }}
      >
        <div className="space-y-3">
          <Field label="Name" required error={errors.name?.[0]}>
            {(p) => (
              <Input
                {...p}
                placeholder="Brake pads"
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Inside" hint="Leave empty to make it a top-level group">
            {(p) => (
              <Select
                {...p}
                className="w-full"
                placeholder="A group of its own"
                value={draft.parentId ?? undefined}
                onChange={(parentId) => setDraft((c) => ({ ...c, parentId: parentId || null }))}
                options={parentOptions}
              />
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="A category with products in it, or with sub-categories under it, cannot be deleted — move those first."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          const result = remove(deleting.id)
          setDeleting(null)
          if (result.ok) toast.success('Category deleted')
          else toast.error(result.error)
        }}
      />
    </>
  )
}
