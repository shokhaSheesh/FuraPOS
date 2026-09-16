import { useMemo, useState } from 'react'
import { AlertTriangle, Check, FileSpreadsheet, Upload } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { Field } from '@/shared/components/Field'
import { Steps } from '@/shared/components/Steps'
import { formatNumber } from '@/shared/lib/format'
import { readSpreadsheet, type Grid } from '@/shared/lib/spreadsheet'
import { useDataStore } from '@/data/store'
import type { VariationRow } from '@/features/products/model/product'

/** What a spreadsheet column can be mapped to. */
type FieldKey = 'barcode' | 'sku' | 'quantity' | 'price' | 'currency' | 'ignore'

const FIELDS: { value: FieldKey; label: string }[] = [
  { value: 'ignore', label: 'Ignore this column' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'sku', label: 'SKU' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'price', label: 'Price' },
  { value: 'currency', label: 'Currency' },
]

/** A row we could place against a product, ready to go on the document. */
export interface ImportedLine {
  variation: VariationRow
  quantity: number
  unitCost: number | null
  currency: 'USD' | 'UZS' | null
}

/**
 * Guesses what each column is from its heading.
 *
 * A supplier's file is written in their words, in Russian as often as English,
 * and asking somebody to map twelve columns by hand every time is how the
 * feature stops being used. The guess is only a starting point — every column
 * is still a select the user can correct.
 */
function guessField(heading: string, sample: string): FieldKey {
  const text = heading.toLowerCase()
  const has = (...words: string[]) => words.some((word) => text.includes(word))

  if (has('штрих', 'barcode', 'ean', 'штрихкод')) return 'barcode'
  if (has('артикул', 'sku', 'код', 'code')) return 'sku'
  if (has('кол-во', 'колво', 'количество', 'qty', 'quantity', 'amount')) return 'quantity'
  if (has('валюта', 'currency')) return 'currency'
  if (has('цена', 'price', 'стоим', 'cost')) return 'price'
  // No heading worth reading — a column of nothing but digits is a quantity
  // more often than it is anything else, but never guess an identifier.
  if (!heading.trim() && /^\d+$/.test(sample)) return 'quantity'
  return 'ignore'
}

const number = (value: string) => {
  // "12 500,50" and "12,500.50" both mean the same thing in different places.
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/,(\d{1,2})$/, '.$1')
    .replace(/,/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Loading a supplier's spreadsheet onto a document, in the reference product's
 * three steps: choose the file, say what its columns are, then import.
 *
 * **Nothing is created.** A row that matches no product we carry is reported
 * and skipped, never invented: a delivery note is not where a catalogue should
 * grow, and a typo in a supplier's barcode column would otherwise leave a
 * product nobody can find again.
 */
export function ImportProductsDialog({
  open,
  onOpenChange,
  onImport,
  quantityLabel = 'Quantity',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (lines: ImportedLine[]) => void
  /** What the quantity column means here — "Ordering" on an order. */
  quantityLabel?: string
}) {
  const variations = useDataStore((s) => s.variations)
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [grid, setGrid] = useState<Grid>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<FieldKey[]>([])
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep(1)
    setFileName('')
    setGrid([])
    setHasHeader(true)
    setMapping([])
    setError(null)
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const rows = await readSpreadsheet(file)
      if (rows.length === 0) throw new Error('There is nothing in that file')
      const width = Math.max(...rows.map((row) => row.length))
      const padded = rows.map((row) => [...row, ...Array(width - row.length).fill('')])
      setGrid(padded)
      setFileName(file.name)
      const headings = padded[0] ?? []
      const first = padded[1] ?? padded[0] ?? []
      setMapping(headings.map((heading, i) => guessField(heading, first[i] ?? '')))
      setStep(2)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That file could not be read')
    }
  }

  const body = hasHeader ? grid.slice(1) : grid
  const headings = grid[0] ?? []

  /** Where each field ended up, or -1. The last column wins a duplicate. */
  const columnOf = (field: FieldKey) => mapping.lastIndexOf(field)

  const result = useMemo(() => {
    const barcodeAt = columnOf('barcode')
    const skuAt = columnOf('sku')
    const quantityAt = columnOf('quantity')
    const priceAt = columnOf('price')
    const currencyAt = columnOf('currency')

    const byBarcode = new Map(variations.filter((v) => v.barcode).map((v) => [v.barcode!, v]))
    const bySku = new Map(variations.map((v) => [v.sku.toLowerCase(), v]))

    const matched: ImportedLine[] = []
    const missed: { row: number; code: string }[] = []

    body.forEach((row, index) => {
      const code = (barcodeAt > -1 ? row[barcodeAt] : '') || (skuAt > -1 ? row[skuAt] : '') || ''
      const variation =
        (barcodeAt > -1 ? byBarcode.get(row[barcodeAt] ?? '') : undefined) ??
        (skuAt > -1 ? bySku.get((row[skuAt] ?? '').toLowerCase()) : undefined)

      if (!variation) {
        if (code) missed.push({ row: index + (hasHeader ? 2 : 1), code })
        return
      }

      const quantity = quantityAt > -1 ? (number(row[quantityAt] ?? '') ?? 0) : 1
      if (quantity <= 0) return

      const price = priceAt > -1 ? number(row[priceAt] ?? '') : null
      const currencyText = (currencyAt > -1 ? (row[currencyAt] ?? '') : '').toUpperCase()

      matched.push({
        variation,
        quantity,
        unitCost: price,
        currency: currencyText.includes('USD') ? 'USD' : currencyText ? 'UZS' : null,
      })
    })

    return { matched, missed }
  }, [body, mapping, variations, hasHeader])

  const identified = columnOf('barcode') > -1 || columnOf('sku') > -1

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title="Upload a spreadsheet"
      description="Rows are matched to products we already carry, by barcode or SKU."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-fg-subtle text-2xs">
            {step === 1
              ? '.xlsx or .csv'
              : `${formatNumber(result.matched.length)} of ${formatNumber(body.length)} rows matched`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === 2 ? (
              <Button
                variant="primary"
                disabled={!identified || result.matched.length === 0}
                title={identified ? undefined : 'Say which column holds the barcode or SKU'}
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            ) : step === 3 ? (
              <Button
                variant="primary"
                onClick={() => {
                  onImport(result.matched)
                  reset()
                  onOpenChange(false)
                }}
              >
                Add {formatNumber(result.matched.length)} to the document
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Steps
          steps={['Choose a file', 'Match the columns', 'Import']}
          current={step}
          onSelect={(next) => grid.length > 0 && setStep(next)}
          selectable={grid.length > 0}
        />

        {step === 1 ? (
          <div className="space-y-3">
            <label className="border-border hover:border-border-strong rounded-card flex cursor-pointer flex-col items-center gap-2 border border-dashed p-10 text-center">
              <Upload className="text-fg-subtle size-6" />
              <span className="text-fg text-sm font-medium">
                Drop a spreadsheet here, or click to choose one
              </span>
              <span className="text-fg-subtle text-2xs">
                Excel (.xlsx) or a comma- or semicolon-separated .csv
              </span>
              <input
                type="file"
                className="sr-only"
                accept=".xlsx,.csv,text/csv"
                onChange={(event) => pick(event.target.files?.[0])}
              />
            </label>
            {error ? (
              <p className="text-danger flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4" />
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-fg-muted flex items-center gap-2 text-sm">
                <FileSpreadsheet className="size-4" />
                {fileName} · {formatNumber(grid.length)} rows
              </p>
              <Field label="First row is a heading">
                {() => (
                  <Switch
                    aria-label="First row is a heading"
                    checked={hasHeader}
                    onCheckedChange={setHasHeader}
                  />
                )}
              </Field>
            </div>

            <div className="border-border rounded-card overflow-x-auto border">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="bg-canvas">
                    {headings.map((heading, index) => (
                      <th key={index} className="p-2 text-left align-top font-normal">
                        <p className="text-fg-subtle text-2xs mb-1 truncate">
                          {hasHeader ? heading || `Column ${index + 1}` : `Column ${index + 1}`}
                        </p>
                        <Select
                          className="w-40"
                          aria-label={`What column ${index + 1} holds`}
                          value={mapping[index] ?? 'ignore'}
                          onChange={(value) =>
                            setMapping((current) =>
                              current.map((f, i) => (i === index ? (value as FieldKey) : f)),
                            )
                          }
                          options={FIELDS.map((field) => ({
                            value: field.value,
                            label: field.value === 'quantity' ? quantityLabel : field.label,
                          }))}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.slice(0, 5).map((row, index) => (
                    <tr key={index} className="border-border border-t">
                      {row.map((cell, i) => (
                        <td key={i} className="text-fg-muted max-w-48 truncate p-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!identified ? (
              <p className="text-warning flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4" />
                Mark the column holding the barcode or the SKU — it is what a row is matched on.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-fg flex items-center gap-2 text-sm">
              <Check className="text-success size-4" />
              {formatNumber(result.matched.length)} rows matched a product and will be added.
            </p>

            {result.missed.length > 0 ? (
              <div className="border-border rounded-card border p-3">
                <p className="text-warning flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4" />
                  {formatNumber(result.missed.length)} rows matched nothing and will be skipped
                </p>
                <p className="text-fg-subtle text-2xs mt-1">
                  Nothing is created from a spreadsheet. Add these to the catalogue first if they
                  are products you now carry.
                </p>
                <ul className="text-fg-muted mt-2 max-h-40 space-y-0.5 overflow-y-auto text-sm">
                  {result.missed.slice(0, 50).map((miss) => (
                    <li key={`${miss.row}-${miss.code}`}>
                      Row {miss.row}: <span className="font-mono">{miss.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
