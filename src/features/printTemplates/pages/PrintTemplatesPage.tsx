import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Copy, Pencil, Plus, Printer, Tags, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchInput } from '@/shared/components/SearchInput'
import { StatusChips } from '@/shared/components/StatusChips'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate } from '@/shared/lib/format'
import { usePrintTemplates, useTemplateActions, useTemplateCounts } from '../api/templates'
import {
  TEMPLATE_KINDS,
  describeTemplate,
  sizeLabel,
  type PrintTemplate,
  type TemplateKind,
} from '../model/template'
import { TemplatePreview, fitScale } from '../components/TemplatePreview'
import { PrintSheetModal } from '../components/PrintSheetModal'

/**
 * Print templates.
 *
 * A grid rather than a table, because a template *is* its appearance — a row
 * of text saying "80 × 50 mm, four fields" tells you nothing about whether the
 * name will fit. Every card shows the real thing, drawn to scale.
 */
export default function PrintTemplatesPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data } = usePrintTemplates({ search: query.search, kind: query.kind })
  const counts = useTemplateCounts()
  const actions = useTemplateActions()

  const [deleting, setDeleting] = useState<PrintTemplate | null>(null)
  const [printing, setPrinting] = useState<PrintTemplate | null>(null)

  return (
    <>
      <PageHeader
        title="Print templates"
        description="What goes on the part, on the shelf and in the customer's hand."
        action={
          can('products.printTemplates.create') ? (
            <Button variant="primary" onClick={() => navigate(paths.products.newPrintTemplate)}>
              <Plus />
              Add template
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={(query.search as string) ?? ''}
          onChange={(search) => setQuery({ search })}
          placeholder="Search templates…"
        />
        <StatusChips<TemplateKind>
          ariaLabel="Filter by what it prints"
          value={(query.kind as TemplateKind) ?? null}
          onChange={(kind) => setQuery({ kind })}
          counts={counts}
          options={[
            { value: null, label: 'All' },
            ...TEMPLATE_KINDS.map((kind) => ({ value: kind.value, label: kind.label })),
          ]}
        />
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No templates yet"
          description="A template is a size, a code and the fields that print on it. Make one and every part can be labelled from it."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((template) => (
            <Card key={template.id} className="flex h-full flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-fg truncate font-medium">{template.name}</p>
                    <p className="text-fg-subtle text-2xs truncate">{describeTemplate(template)}</p>
                  </div>
                  <RowActions
                    actions={[
                      {
                        label: 'Print',
                        icon: Printer,
                        onSelect: () => setPrinting(template),
                      },
                      {
                        label: 'Edit',
                        icon: Pencil,
                        hidden: !can('products.printTemplates.edit'),
                        onSelect: () => navigate(paths.products.editPrintTemplate(template.id)),
                      },
                      {
                        label: 'Duplicate',
                        icon: Copy,
                        hidden: !can('products.printTemplates.create'),
                        onSelect: () => {
                          const copy = actions.duplicate(template.id)
                          if (copy) toast.success(`${copy.name} created`)
                        },
                      },
                      {
                        label: 'Delete',
                        icon: Trash2,
                        destructive: true,
                        hidden: !can('products.printTemplates.delete'),
                        onSelect: () => setDeleting(template),
                      },
                    ]}
                  />
                </div>

                {/* The point of the card. Scaled down, but in proportion. */}
                <div className="bg-canvas rounded-card flex h-44 flex-1 items-center justify-center p-3">
                  <TemplatePreview
                    template={template}
                    mmToPx={fitScale(template.widthMm, template.heightMm, 200, 150)}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Badge tone="info">{sizeLabel(template)}</Badge>
                  <span className="text-fg-subtle text-2xs">
                    Changed {formatDate(template.updatedAt)}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <PrintSheetModal
        template={printing}
        open={printing !== null}
        onOpenChange={(open) => {
          if (!open) setPrinting(null)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name}?`}
        body="Labels already printed are unaffected — this only removes the template."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return
          actions.remove(deleting.id)
          setDeleting(null)
          toast.success('Template deleted')
        }}
      />
    </>
  )
}
