import { useMemo, useState } from 'react'
import { Columns3, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { StatusChips } from '@/shared/components/StatusChips'
import { Field } from '@/shared/components/Field'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { TagsInput } from '@/shared/ui/TagsInput'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { formatDate, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import {
  PRODUCT_FIELD_LEVELS,
  PRODUCT_FIELD_TYPES,
  isFieldNameTaken,
  isFilled,
  productFieldLevelLabel,
  productFieldSchema,
  productFieldTypeLabel,
  type ProductField,
  type ProductFieldInput,
  type ProductFieldLevel,
} from '@/shared/types/productFields'

/**
 * The columns the product list already has, so this page is the whole
 * directory and not only the added ones. Read-only: they are part of the
 * product, and other screens — sales, orders, transfers — rely on them.
 * In the product list's own order.
 */
const BUILT_IN: { name: string; type: string; level: ProductFieldLevel }[] = [
  { name: 'Image', type: 'Image', level: 'variation' },
  { name: 'Variation ID', type: 'Generated', level: 'variation' },
  { name: 'Variation name', type: 'Text', level: 'variation' },
  { name: 'Barcode', type: 'Text', level: 'variation' },
  { name: 'SKU', type: 'Text', level: 'variation' },
  { name: 'Categories', type: 'List', level: 'product' },
  { name: 'Brand', type: 'List', level: 'product' },
  { name: 'Description', type: 'Text', level: 'product' },
  { name: 'Tags', type: 'Tags', level: 'product' },
  { name: 'Frequently bought together', type: 'Products', level: 'variation' },
  { name: 'Analogues', type: 'Products', level: 'variation' },
  { name: 'Shippable', type: 'Yes / no', level: 'product' },
  { name: 'Show online', type: 'Yes / no', level: 'product' },
  { name: 'Tracking', type: 'Yes / no', level: 'product' },
  { name: 'Sellable', type: 'Yes / no', level: 'product' },
  { name: 'Countable', type: 'Yes / no', level: 'product' },
  { name: 'Taxable', type: 'Yes / no', level: 'product' },
  { name: 'Manufactured', type: 'Yes / no', level: 'product' },
  { name: 'Weighted', type: 'Yes / no', level: 'product' },
  { name: 'Zone', type: 'Text', level: 'variation' },
  { name: 'Location', type: 'Stock', level: 'variation' },
  { name: 'Quantity', type: 'Stock', level: 'variation' },
  { name: 'Sale price per unit', type: 'Money', level: 'variation' },
  { name: 'Total sale value', type: 'Calculated', level: 'variation' },
  { name: 'Discounted', type: 'Money', level: 'variation' },
  { name: 'Discount', type: 'Calculated', level: 'variation' },
  { name: 'Supplier price per unit', type: 'Money', level: 'variation' },
  { name: 'Total supplier value', type: 'Calculated', level: 'variation' },
  { name: 'Landed cost', type: 'Money', level: 'variation' },
  { name: 'Make', type: 'List', level: 'product' },
  { name: 'Cargo weight', type: 'Number', level: 'product' },
  { name: 'Cargo size', type: 'Text', level: 'product' },
  { name: 'End category', type: 'Calculated', level: 'product' },
  { name: 'Product brand', type: 'Text', level: 'product' },
  { name: 'Mobile SKU', type: 'Text', level: 'variation' },
  { name: 'Mobile product name', type: 'Text', level: 'variation' },
  { name: 'Part', type: 'List', level: 'variation' },
  { name: 'OEM', type: 'Text', level: 'product' },
  { name: 'Type', type: 'Text', level: 'product' },
  { name: 'Model', type: 'List', level: 'product' },
  { name: 'Product address', type: 'Text', level: 'variation' },
]

type Row =
  | { kind: 'custom'; id: string; field: ProductField; answers: number }
  | { kind: 'builtin'; id: string; name: string; type: string; level: ProductFieldLevel }

type Source = 'custom' | 'builtin'

const EMPTY_DRAFT: ProductFieldInput = { name: '', type: 'text', options: [], level: 'product' }

/**
 * Product columns — the directory of every column a product can carry, and
 * the place to add new ones.
 *
 * A column added here appears on the product list (and in its Columns menu)
 * and is asked for on the create and edit form: with the product's own fields
 * when it has one answer per product, or on each variation when left and right
 * can differ. The type and level are fixed once the column exists, because
 * answers already typed would not survive the change.
 */
export default function ProductColumnsSettingsPage() {
  const { can } = useSession()
  const fields = useDataStore((s) => s.productFields)
  const products = useDataStore((s) => s.products)
  const create = useDataStore((s) => s.createProductField)
  const update = useDataStore((s) => s.updateProductField)
  const remove = useDataStore((s) => s.deleteProductField)

  const [source, setSource] = useState<Source | null>(null)
  const [editing, setEditing] = useState<ProductField | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ProductFieldInput>(EMPTY_DRAFT)
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState<{ field: ProductField; answers: number } | null>(null)

  /** How many products or variations have filled a column in — what deleting it loses. */
  const answers = useMemo(() => {
    const counts = new Map<string, number>()
    const add = (values: Record<string, unknown>) => {
      for (const [id, value] of Object.entries(values)) {
        if (isFilled(value as never)) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    for (const product of products) {
      add(product.customFields)
      for (const variation of product.variations) add(variation.customFields)
    }
    return counts
  }, [products])

  const rows = useMemo<Row[]>(() => {
    const custom: Row[] = fields.map((field) => ({
      kind: 'custom',
      id: field.id,
      field,
      answers: answers.get(field.id) ?? 0,
    }))
    const builtin: Row[] = BUILT_IN.map((entry) => ({
      kind: 'builtin',
      id: `builtin:${entry.name}`,
      ...entry,
    }))
    if (source === 'custom') return custom
    if (source === 'builtin') return builtin
    // Yours first: they are the ones this page is for editing.
    return [...custom, ...builtin]
  }, [fields, answers, source])

  const parsed = productFieldSchema.safeParse(draft)
  const nameTaken =
    draft.name.trim() !== '' &&
    (isFieldNameTaken(fields, draft.name, editing?.id) ||
      BUILT_IN.some((entry) => entry.name.toLowerCase() === draft.name.trim().toLowerCase()))
  const errors = showErrors && !parsed.success ? parsed.error.flatten().fieldErrors : {}

  const openFor = (field: ProductField | null) => {
    setEditing(field)
    setDraft(
      field
        ? { name: field.name, type: field.type, options: [...field.options], level: field.level }
        : EMPTY_DRAFT,
    )
    setShowErrors(false)
    setOpen(true)
  }

  const save = () => {
    setShowErrors(true)
    if (!parsed.success || nameTaken) return
    if (editing) {
      update(editing.id, { name: parsed.data.name, options: parsed.data.options })
      toast.success(`${parsed.data.name} saved`)
    } else {
      create(parsed.data)
      toast.success(`${parsed.data.name} added to products`)
    }
    setOpen(false)
  }

  const columns = useMemo<TableColumn<Row>[]>(
    () => [
      {
        id: 'name',
        header: 'Column',
        enableHiding: false,
        cell: ({ row }) =>
          row.original.kind === 'custom' ? (
            <span className="text-fg font-medium">{row.original.field.name}</span>
          ) : (
            <span className="text-fg-muted inline-flex items-center gap-1.5">
              <Lock className="size-3.5" />
              {row.original.name}
            </span>
          ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const r = row.original
          if (r.kind === 'builtin') return r.type
          return r.field.type === 'select' ? (
            <span title={r.field.options.join(', ')}>List · {r.field.options.length} choices</span>
          ) : (
            productFieldTypeLabel(r.field.type)
          )
        },
      },
      {
        id: 'level',
        header: 'Filled in for',
        cell: ({ row }) =>
          productFieldLevelLabel(
            row.original.kind === 'custom' ? row.original.field.level : row.original.level,
          ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }) =>
          row.original.kind === 'custom' ? (
            <Badge tone="info">Added by you</Badge>
          ) : (
            <Badge>Built in</Badge>
          ),
      },
      {
        id: 'answers',
        header: 'Filled in',
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.kind === 'custom' ? (
            <span className="tabular-nums">{formatNumber(row.original.answers)}</span>
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        id: 'createdAt',
        header: 'Added',
        cell: ({ row }) =>
          row.original.kind === 'custom' ? (
            formatDate(row.original.field.createdAt)
          ) : (
            <span className="text-fg-subtle">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const r = row.original
          if (r.kind === 'builtin') return null
          return (
            <RowActions
              actions={[
                {
                  label: 'Edit',
                  icon: Pencil,
                  hidden: !can('settings.products.edit'),
                  onSelect: () => openFor(r.field),
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  destructive: true,
                  hidden: !can('settings.products.delete'),
                  onSelect: () => setDeleting({ field: r.field, answers: r.answers }),
                },
              ]}
            />
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  )

  return (
    <>
      <PageHeader
        title="Product columns"
        description="Every column a product carries. Add your own — they appear on the product list and on the create and edit form."
        action={
          can('settings.products.create') ? (
            <Button variant="primary" onClick={() => openFor(null)}>
              <Plus />
              Add column
            </Button>
          ) : null
        }
        below={
          <StatusChips
            ariaLabel="Filter by source"
            options={[
              { value: null, label: 'All' },
              { value: 'custom', label: 'Added by you' },
              { value: 'builtin', label: 'Built in' },
            ]}
            value={source}
            onChange={setSource}
            counts={{
              all: fields.length + BUILT_IN.length,
              custom: fields.length,
              builtin: BUILT_IN.length,
            }}
          />
        }
      />

      <DataTable
        storageKey="settings-product-columns"
        columns={columns}
        data={rows}
        total={rows.length}
        isLoading={false}
        getRowId={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Columns3}
            title="No columns of your own yet"
            description="Add one for anything your catalogue tracks that the built-in columns do not — a material, a warranty, a country of origin."
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${editing.name}` : 'New product column'}
        description={
          editing
            ? 'The type and what it is filled in for are fixed once a column exists.'
            : 'It appears on the product list and on the product form straight away.'
        }
        primary={{ label: editing ? 'Save changes' : 'Add column', onClick: save }}
      >
        <div className="space-y-3">
          <Field
            label="Column name"
            required
            error={nameTaken ? 'A column with this name already exists' : errors.name?.[0]}
          >
            {(p) => (
              <Input
                {...p}
                placeholder="Material"
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              />
            )}
          </Field>
          <Field label="Type" hint={PRODUCT_FIELD_TYPES.find((t) => t.value === draft.type)?.hint}>
            {() => (
              <Select
                aria-label="Type"
                className="w-full"
                disabled={Boolean(editing)}
                value={draft.type}
                onChange={(type) =>
                  setDraft((c) => ({ ...c, type, options: type === 'select' ? c.options : [] }))
                }
                options={PRODUCT_FIELD_TYPES}
              />
            )}
          </Field>
          {draft.type === 'select' ? (
            <Field
              label="Choices"
              required
              hint="Press Enter after each one"
              error={errors.options?.[0]}
            >
              {(p) => (
                <TagsInput
                  id={p.id}
                  placeholder="Add a choice…"
                  value={draft.options}
                  onChange={(options) => setDraft((c) => ({ ...c, options }))}
                />
              )}
            </Field>
          ) : null}
          <Field
            label="Filled in for"
            hint={PRODUCT_FIELD_LEVELS.find((l) => l.value === draft.level)?.hint}
          >
            {() =>
              editing ? (
                <p className="text-fg text-sm">{productFieldLevelLabel(draft.level)}</p>
              ) : (
                <SegmentedControl
                  aria-label="Filled in for"
                  value={draft.level}
                  onChange={(level) => setDraft((c) => ({ ...c, level }))}
                  options={PRODUCT_FIELD_LEVELS}
                />
              )
            }
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={`Delete ${deleting?.field.name}?`}
        body={
          deleting?.answers
            ? `It leaves the product list and the form, and the answers on ${formatNumber(deleting.answers)} ${deleting.field.level === 'product' ? 'products' : 'variations'} are deleted with it.`
            : 'It leaves the product list and the form. Nothing has been filled in yet.'
        }
        confirmLabel="Delete column"
        destructive
        onConfirm={() => {
          if (!deleting) return
          remove(deleting.field.id)
          toast.success(`${deleting.field.name} deleted`)
          setDeleting(null)
        }}
      />
    </>
  )
}
