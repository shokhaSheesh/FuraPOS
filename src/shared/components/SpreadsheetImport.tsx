import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft, Check, FileDown, Paperclip, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { Field } from '@/shared/components/Field'
import { Steps } from '@/shared/components/Steps'
import { formatNumber } from '@/shared/lib/format'
import { downloadCsv } from '@/shared/lib/csv'
import { ENCODINGS, readSpreadsheet, type Encoding, type Grid } from '@/shared/lib/spreadsheet'
import { useDataStore } from '@/data/store'
import type { VariationRow } from '@/features/products/model/product'

/** What a spreadsheet column can be mapped to. */
type FieldKey = 'barcode' | 'sku' | 'quantity' | 'price' | 'currency' | 'ignore'

/** Required fields carry a mark, as the reference product marks its own. */
const FIELDS: { value: FieldKey; label: string; required?: boolean }[] = [
  { value: 'ignore', label: 'Ignore this column' },
  { value: 'barcode', label: 'Barcode', required: true },
  { value: 'sku', label: 'SKU', required: true },
  { value: 'quantity', label: 'Quantity' },
  { value: 'price', label: 'Price' },
  { value: 'currency', label: 'Currency' },
]

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
 * feature stops being used. Every guess stays a select the user can correct.
 */
function guessField(heading: string, sample: string): FieldKey {
  const text = heading.toLowerCase()
  const has = (...words: string[]) => words.some((word) => text.includes(word))

  if (has('штрих', 'barcode', 'ean')) return 'barcode'
  if (has('артикул', 'sku', 'код', 'code')) return 'sku'
  if (has('кол-во', 'колво', 'количество', 'qty', 'quantity', 'amount')) return 'quantity'
  if (has('валюта', 'currency')) return 'currency'
  if (has('цена', 'price', 'стоим', 'cost')) return 'price'
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
 * Loading a supplier's spreadsheet onto a document, as the reference product
 * does it: a **page** of its own, in three steps — choose the file, match its
 * columns, import.
 *
 * A page rather than a dialog because of step 2. A supplier's export runs to
 * twenty-odd columns and every one of them needs a decision; inside a modal
 * that is a strip of selects scrolling sideways in a box, which is exactly the
 * screen where somebody most needs to see the whole thing at once.
 *
 * **Nothing is created.** A row matching no product we carry is reported and
 * skipped: a delivery note is not where a catalogue should grow, and a typo in
 * a supplier's barcode column would otherwise leave a product nobody can find.
 */
export function SpreadsheetImport({
  title,
  backTo,
  backLabel,
  quantityLabel = 'Quantity',
  onImport,
}: {
  title: string
  backTo: string
  backLabel: string
  /** What the quantity column means here — "Ordering" on an order. */
  quantityLabel?: string
  /** Called with what matched. Navigating away afterwards is the caller's job. */
  onImport: (lines: ImportedLine[]) => void
}) {
  const variations = useDataStore((s) => s.variations)
  const [step, setStep] = useState(1)

  const [file, setFile] = useState<File | null>(null)
  const [grid, setGrid] = useState<Grid>([])
  const [encoding, setEncoding] = useState<Encoding>('utf-8')
  const [confidence, setConfidence] = useState(1)
  const [isCsv, setIsCsv] = useState(false)
  const [hasHeader, setHasHeader] = useState(true)
  const [fallbackCurrency, setFallbackCurrency] = useState<'USD' | 'UZS'>('USD')
  const [mapping, setMapping] = useState<FieldKey[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async (chosen: File, as?: Encoding) => {
    setError(null)
    try {
      const read = await readSpreadsheet(chosen, as)
      if (read.grid.length === 0) throw new Error('There is nothing in that file')

      const width = Math.max(...read.grid.map((row) => row.length))
      const padded = read.grid.map((row) => [...row, ...Array(width - row.length).fill('')])
      setGrid(padded)
      setFile(chosen)
      setEncoding(read.encoding)
      setConfidence(read.confidence)
      setIsCsv(read.isCsv)

      const headings = padded[0] ?? []
      const first = padded[1] ?? padded[0] ?? []
      setMapping(headings.map((heading, i) => guessField(heading, first[i] ?? '')))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That file could not be read')
      setGrid([])
      setFile(null)
    }
  }

  const body = hasHeader ? grid.slice(1) : grid
  const headings = grid[0] ?? []
  const columnOf = (field: FieldKey) => mapping.lastIndexOf(field)

  const result = useMemo(() => {
    const barcodeAt = mapping.lastIndexOf('barcode')
    const skuAt = mapping.lastIndexOf('sku')
    const quantityAt = mapping.lastIndexOf('quantity')
    const priceAt = mapping.lastIndexOf('price')
    const currencyAt = mapping.lastIndexOf('currency')

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
      const written = (currencyAt > -1 ? (row[currencyAt] ?? '') : '').toUpperCase()

      matched.push({
        variation,
        quantity,
        unitCost: price,
        // The file's own currency column wins; the setting above is what a
        // file without one is read as.
        currency: written.includes('USD')
          ? 'USD'
          : written.includes('UZS') || written.includes('СУМ')
            ? 'UZS'
            : price === null
              ? null
              : fallbackCurrency,
      })
    })

    return { matched, missed }
  }, [body, mapping, variations, hasHeader, fallbackCurrency])

  const identified = columnOf('barcode') > -1 || columnOf('sku') > -1
  const unmapped = FIELDS.filter(
    (field) => field.value !== 'ignore' && !mapping.includes(field.value),
  )

  /** The shape we can read, as a file somebody can fill in. */
  const downloadTemplate = () =>
    downloadCsv(
      'product-import-template.csv',
      ['Barcode', 'SKU', quantityLabel, 'Price', 'Currency'],
      [
        ['4600000000000', 'SKU-00001', '10', '12.50', 'USD'],
        ['', 'SKU-00002-L', '4', '250000', 'UZS'],
      ],
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={backLabel} asChild>
          <Link to={backTo}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fg text-lg font-semibold">{title}</h1>
      </div>

      <Steps
        steps={['Choose a file', 'Match the columns', 'Import']}
        current={step}
        onSelect={(next) => grid.length > 0 && setStep(next)}
        selectable={grid.length > 0}
        wide
      />

      {step === 1 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Supplier price currency"
                required
                hint="What a price is read as when the file has no currency column of its own"
              >
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={fallbackCurrency}
                    onChange={(value) => setFallbackCurrency(value as 'USD' | 'UZS')}
                    options={[
                      { value: 'USD', label: 'USD' },
                      { value: 'UZS', label: 'UZS' },
                    ]}
                  />
                )}
              </Field>

              <Field label="Example file" hint="The columns we can read, ready to fill in">
                {() => (
                  <Button variant="secondary" className="w-full" onClick={downloadTemplate}>
                    <FileDown />
                    Download a template
                  </Button>
                )}
              </Field>

              {/* Only a CSV has an encoding to get wrong — an xlsx carries its
                  own inside the file. */}
              {isCsv ? (
                <Field
                  label="Encoding"
                  className="sm:col-span-2"
                  hint="Excel on a Russian Windows saves CSV as windows-1251; read as UTF-8 that file is a column of question marks"
                >
                  {(p) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={encoding}
                      onChange={(value) => file && load(file, value as Encoding)}
                      options={ENCODINGS.map((value) => ({
                        value,
                        label:
                          value === encoding
                            ? `${value} — ${Math.round(confidence * 100)}% sure`
                            : value,
                      }))}
                    />
                  )}
                </Field>
              ) : null}

              <div className="sm:col-span-2">
                <p className="text-fg-muted mb-1 text-sm">Upload a spreadsheet</p>
                <label className="border-border hover:border-border-strong rounded-card flex cursor-pointer flex-col items-center gap-2 border border-dashed p-10 text-center">
                  <Upload className="text-fg-subtle size-6" />
                  <span className="text-fg text-sm font-medium">
                    Drop a file here, or click to choose one
                  </span>
                  <span className="text-fg-subtle text-2xs">
                    Excel (.xlsx), or a comma-, semicolon- or tab-separated .csv
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".xlsx,.csv,text/csv"
                    onChange={(event) => {
                      const chosen = event.target.files?.[0]
                      if (chosen) load(chosen)
                    }}
                  />
                </label>
                {file ? (
                  <p className="text-fg-muted mt-2 flex items-center gap-2 text-sm">
                    <Paperclip className="size-4" />
                    {file.name} · {formatNumber(grid.length)} rows
                  </p>
                ) : null}
                {error ? (
                  <p className="text-danger mt-2 flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4" />
                    {error}
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spreadsheet settings</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="border-border rounded-card flex items-start justify-between gap-4 border p-4 sm:max-w-md">
                <div className="min-w-0">
                  <p className="text-fg text-sm font-medium">First row is a heading</p>
                  <p className="text-fg-subtle text-2xs mt-0.5">
                    Turn this on when the first row names the columns rather than holding a product.
                  </p>
                </div>
                <Switch
                  aria-label="First row is a heading"
                  checked={hasHeader}
                  onCheckedChange={setHasHeader}
                />
              </div>
              {/*
                The reference product also offers to generate a barcode and an
                SKU, because its import *creates* products. Ours only matches
                against ones we already carry, so there is nothing to generate
                — see the note on this component.
              */}
            </CardBody>
          </Card>
        </>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>What each column holds</CardTitle>
              <span className="text-fg-muted text-sm">
                {formatNumber(result.matched.length)} of {formatNumber(body.length)} rows matched
              </span>
            </div>
            {unmapped.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-fg-subtle text-2xs">Not mapped yet:</span>
                {unmapped.map((field) => (
                  <span
                    key={field.value}
                    className="bg-surface-inset text-fg-muted text-2xs rounded-full px-2 py-0.5"
                  >
                    {field.value === 'quantity' ? quantityLabel : field.label}
                  </span>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="bg-canvas">
                    <th className="text-fg-subtle text-2xs w-10 p-2 text-right font-normal">#</th>
                    {headings.map((heading, index) => (
                      <th key={index} className="p-2 text-left align-top font-normal">
                        <p className="text-fg-subtle text-2xs mb-1 max-w-44 truncate">
                          {hasHeader ? heading || `Column ${index + 1}` : `Column ${index + 1}`}
                        </p>
                        <Select
                          className="w-44"
                          aria-label={`What column ${index + 1} holds`}
                          value={mapping[index] ?? 'ignore'}
                          onChange={(value) =>
                            setMapping((current) =>
                              current.map((f, i) => (i === index ? (value as FieldKey) : f)),
                            )
                          }
                          options={FIELDS.map((field) => ({
                            value: field.value,
                            label:
                              (field.value === 'quantity' ? quantityLabel : field.label) +
                              (field.required ? ' *' : ''),
                          }))}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.slice(0, 8).map((row, index) => (
                    <tr key={index} className="border-border border-t">
                      <td className="text-fg-subtle text-2xs p-2 text-right tabular-nums">
                        {index + (hasHeader ? 2 : 1)}
                      </td>
                      {row.map((cell, i) => (
                        <td key={i} className="text-fg-muted max-w-44 truncate p-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!identified ? (
              <p className="text-warning border-border flex items-center gap-2 border-t px-4 py-3 text-sm">
                <AlertTriangle className="size-4" />
                Mark the column holding the barcode or the SKU — it is what a row is matched on.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ready to import</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
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
                <ul className="text-fg-muted mt-2 max-h-56 space-y-0.5 overflow-y-auto text-sm">
                  {result.missed.slice(0, 100).map((miss) => (
                    <li key={`${miss.row}-${miss.code}`}>
                      Row {miss.row}: <span className="font-mono">{miss.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <div className="border-border bg-surface rounded-card flex flex-wrap items-center justify-between gap-3 border p-3">
        <span className="text-fg-subtle text-2xs">
          {step === 1
            ? 'Excel (.xlsx) or .csv'
            : `${formatNumber(result.matched.length)} of ${formatNumber(body.length)} rows matched`}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to={backTo}>Cancel</Link>
          </Button>
          {step < 3 ? (
            <Button
              variant="primary"
              disabled={grid.length === 0 || (step === 2 && !identified)}
              title={
                step === 2 && !identified ? 'Say which column holds the barcode or SKU' : undefined
              }
              onClick={() => setStep(step + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={result.matched.length === 0}
              onClick={() => onImport(result.matched)}
            >
              Add {formatNumber(result.matched.length)} products
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
