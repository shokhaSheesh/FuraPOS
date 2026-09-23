import { useMemo, useState } from 'react'
import { Printer, Tags, Trash2, X } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { Field } from '@/shared/components/Field'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { QuantityStepper } from '@/shared/components/catalogue/VariationsDialog'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import { t, tn } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import { kindLabel, perRow, perSheet, type PrintTemplate } from '../model/template'
import { TemplatePreview, type PreviewValues } from './TemplatePreview'

/** How many labels are wanted of each variation, by variation id. */
export type LabelPicks = Record<string, number>

export const labelCount = (picks: LabelPicks) =>
  Object.values(picks).reduce((sum, copies) => sum + copies, 0)

/**
 * Labels picked off the product list (client request, as OX does it).
 *
 * Printing a label is a job done while reading the catalogue — you find the
 * part, you want a sticker for the shelf — so the count sits on the row and
 * the basket rides along at the corner of the screen. Everything picked
 * prints on one sheet, whatever page of the list it was found on.
 */
export function LabelBasket({
  picks,
  onChange,
}: {
  picks: LabelPicks
  onChange: (picks: LabelPicks) => void
}) {
  const variations = useDataStore((s) => s.variations)
  const templates = useDataStore((s) => s.printTemplates)
  const company = useDataStore((s) => s.company)
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const template: PrintTemplate | null =
    templates.find((entry) => entry.id === templateId) ?? templates[0] ?? null

  const chosen = useMemo(
    () =>
      Object.entries(picks)
        .map(([id, copies]) => ({
          variation: variations.find((entry) => entry.id === id),
          copies,
        }))
        .filter(
          (entry): entry is { variation: (typeof variations)[number]; copies: number } =>
            Boolean(entry.variation) && entry.copies > 0,
        ),
    [picks, variations],
  )

  const total = labelCount(picks)

  const labels = useMemo(() => {
    if (!template) return []
    return chosen.flatMap(({ variation, copies }) => {
      const values: PreviewValues = {
        productName: variation.productName,
        sku: variation.sku,
        // The reference tenant keeps the OEM number in the description.
        oem: variation.oem ?? variation.description ?? '—',
        brand: variation.brandName ?? '—',
        category: variation.categoryName,
        vehicle:
          [...variation.vehicleMakes, ...variation.vehicleModels].filter(Boolean).join(' ') || '—',
        shelf: variation.shelfAddress ?? '—',
        price: formatMoney(variation.salePrice),
        company: company.name,
        date: formatDate(new Date()),
      }
      return Array.from({ length: copies }, (_, index) => ({
        key: `${variation.id}-${index}`,
        values,
      }))
    })
  }, [chosen, template, company.name])

  if (total === 0) return null

  const columns = template ? perRow(template.widthMm) : 1

  return (
    <>
      {/* Rides at the corner, the way the chosen bar does on a document. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-fg shadow-modal fixed right-6 bottom-6 z-40 flex items-center gap-2.5 rounded-full py-3 pr-5 pl-4 text-sm font-medium"
      >
        <Tags className="size-5" />
        {t('Print labels')}
        <span className="bg-primary-fg/20 min-w-6 rounded-full px-2 py-0.5 text-center tabular-nums">
          {formatNumber(total)}
        </span>
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('Labels to print')}
        description={`${formatNumber(total)} ${tn(total, 'label', 'labels')}${
          template
            ? ` · ${formatNumber(Math.ceil(total / perSheet(template.widthMm, template.heightMm)))} ${tn(
                Math.ceil(total / perSheet(template.widthMm, template.heightMm)),
                'sheet',
                'sheets',
              )}`
            : ''
        }`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => onChange({})}>
              <Trash2 />
              {t('Clear the basket')}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {t('Close')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!template}
                onClick={() => window.print()}
              >
                <Printer />
                {t('Print')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <Field
            label={t('Template')}
            hint={t('Any template you have made — a part sticker, a shelf card, a receipt.')}
          >
            {(p) => (
              <Select
                {...p}
                className="w-full"
                value={template?.id}
                onChange={setTemplateId}
                options={templates.map((entry) => ({
                  value: entry.id,
                  label: `${entry.name} · ${kindLabel(entry.kind)} — ${entry.widthMm}×${entry.heightMm} ${t('mm')}`,
                }))}
              />
            )}
          </Field>

          <ul className="divide-border border-border rounded-card divide-y border">
            {chosen.map(({ variation, copies }) => (
              <li key={variation.id} className="flex items-center gap-3 px-3 py-2">
                <ProductThumb src={variation.imageUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm">{variation.fullName}</p>
                  <p className="text-fg-subtle text-2xs font-mono">{variation.sku}</p>
                </div>
                <QuantityStepper
                  size="lg"
                  value={copies}
                  label={variation.fullName}
                  onChange={(next) => onChange({ ...picks, [variation.id]: next })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hover:text-danger"
                  aria-label={t('Remove {label}', { label: variation.fullName })}
                  onClick={() => {
                    const next = { ...picks }
                    delete next[variation.id]
                    onChange(next)
                  }}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>

          {/*
            The sheet itself is never shown on screen (client request): a
            hundred parts would be a hundred previews to scroll past. It is
            still here for the printer, which is the only thing that reads it.
          */}
          {template ? (
            <div
              className="print-sheet hidden gap-2 print:grid"
              style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}
            >
              {labels.map((label) => (
                <TemplatePreview key={label.key} template={template} values={label.values} />
              ))}
            </div>
          ) : (
            <p className="border-border text-fg-subtle rounded-card border border-dashed p-6 text-center text-sm">
              {t('No print template exists yet — make one under Print templates.')}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
