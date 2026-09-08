import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'

const ACCEPTED = '.csv,.xlsx,.xls'

/** Rendered as the template's header row, and as the field checklist below. */
const TEMPLATE_COLUMNS = [
  'SKU',
  'Product name',
  'Option 1 name',
  'Option 1 value',
  'Option 2 name',
  'Option 2 value',
  'Barcode',
  'Category',
  'Brand',
  'Cost',
  'Cost currency',
  'Sale price',
  'Location',
  'Quantity',
]

/**
 * Bulk import, as a job rather than a save.
 *
 * A spreadsheet of a thousand parts cannot be validated while the user waits,
 * so this hands the file over and promises a queued job, never a finished
 * import. Nothing in the catalogue changes here.
 *
 * One row per variation, with the option columns naming the axis and the
 * value: that is the same shape the form builds, so a file exported from the
 * catalogue can be edited and imported back.
 */
export function ImportProductsModal({
  open,
  onOpenChange,
  onQueued,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onQueued: (fileName: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  const close = (next: boolean) => {
    if (!next) setFile(null)
    onOpenChange(next)
  }

  const downloadTemplate = () => {
    const blob = new Blob([`${TEMPLATE_COLUMNS.join(',')}\n`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Import products"
      description="One row per variation. The import runs in the background — you can leave this page."
      primary={{
        label: 'Start import',
        disabled: !file,
        onClick: () => {
          if (!file) return
          onQueued(file.name)
          close(false)
        },
      }}
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const dropped = event.dataTransfer.files[0]
            if (dropped) setFile(dropped)
          }}
          className={cn(
            'rounded-card border-border grid place-items-center gap-2 border border-dashed p-6 text-center transition-colors',
            dragging && 'border-primary-border bg-surface-muted',
          )}
        >
          {file ? (
            <>
              <FileSpreadsheet className="text-fg-muted size-6" />
              <p className="text-fg text-sm font-medium">{file.name}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X />
                Choose a different file
              </Button>
            </>
          ) : (
            <>
              <Upload className="text-fg-subtle size-6" />
              <p className="text-fg-muted text-sm">Drop a CSV or Excel file here</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Choose a file
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            hidden
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="border-border rounded-card border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-fg text-sm font-medium">Not sure about the columns?</p>
              <p className="text-fg-subtle text-2xs">
                Start from the template rather than guessing the header names.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {TEMPLATE_COLUMNS.map((column) => (
              <span
                key={column}
                className="bg-surface-inset text-fg-muted text-2xs rounded-full px-2 py-0.5"
              >
                {column}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
