import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { NumberField } from '@/shared/components/NumberField'
import { Field } from '@/shared/components/Field'
import { formatMoney, formatDate } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { perRow, perSheet, plural, type PrintTemplate } from '../model/template'
import { TemplatePreview, type PreviewValues } from './TemplatePreview'

/**
 * Print a sheet of labels.
 *
 * The step the catalogue has always been missing: a template is only worth
 * having if something comes out of the printer at the end. Pick the parts, say
 * how many of each, and the sheet is laid out at true size — the browser's own
 * print dialog does the rest.
 */
export function PrintSheetModal({
  template,
  open,
  onOpenChange,
}: {
  template: PrintTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const variations = useDataStore((s) => s.variations)
  const company = useDataStore((s) => s.company)
  const [selected, setSelected] = useState<string[]>([])
  const [copies, setCopies] = useState(1)

  const options = useMemo(
    () =>
      variations.slice(0, 200).map((variation) => ({
        value: variation.id,
        label: variation.productName,
        meta: [variation.sku, variation.description].filter(Boolean).join(' · '),
        imageUrl: variation.imageUrl ?? null,
      })),
    [variations],
  )

  const labels = useMemo(() => {
    if (!template) return []
    const chosen = variations.filter((variation) => selected.includes(variation.id))
    return chosen.flatMap((variation) => {
      const values: PreviewValues = {
        productName: variation.productName,
        sku: variation.sku,
        // The reference tenant keeps the OEM number in the free-text
        // description, so that is where the label reads it from.
        oem: variation.description ?? '—',
        brand: variation.brandName ?? '—',
        category: variation.categoryName,
        vehicle:
          [variation.vehicleMake, ...variation.vehicleModels].filter(Boolean).join(' ') || '—',
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
  }, [template, variations, selected, copies, company.name])

  if (!template) return null

  const columns = perRow(template.widthMm)

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Print ${template.name}`}
      description={`${template.widthMm} × ${template.heightMm} mm — ${columns} across a sheet of A4.`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-fg-subtle text-2xs">
            {labels.length === 0
              ? 'Nothing chosen yet'
              : `${plural(labels.length, 'label')} · ${plural(
                  Math.ceil(labels.length / perSheet(template.widthMm, template.heightMm)),
                  'sheet',
                )}`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="primary" disabled={labels.length === 0} onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Parts" hint="Search by name, SKU or OEM code">
            {(p) => (
              <MultiSelect
                {...p}
                className="w-full"
                value={selected}
                onChange={setSelected}
                options={options}
                placeholder="Choose parts to print"
              />
            )}
          </Field>
          <Field label="Copies each">
            {(p) => (
              <NumberField
                {...p}
                className="w-24"
                nullable={false}
                min={1}
                value={copies}
                onChange={(next) => setCopies(Math.min(50, Math.max(1, next ?? 1)))}
              />
            )}
          </Field>
        </div>

        {labels.length === 0 ? (
          <p className="border-border text-fg-subtle rounded-card border border-dashed p-6 text-center text-sm">
            Pick a part to see the sheet.
          </p>
        ) : (
          <div
            className="print-sheet bg-canvas rounded-card grid max-h-80 gap-2 overflow-y-auto p-3"
            style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}
          >
            {labels.map((label) => (
              <TemplatePreview key={label.key} template={template} values={label.values} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
