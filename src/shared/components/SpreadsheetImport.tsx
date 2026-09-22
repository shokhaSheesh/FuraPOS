import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft, Check, FileDown, Paperclip, Plus, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Select } from '@/shared/ui/Select'
import { Switch } from '@/shared/ui/Switch'
import { Field } from '@/shared/components/Field'
import { Steps } from '@/shared/components/Steps'
import { formatNumber } from '@/shared/lib/format'
import { downloadCsv } from '@/shared/lib/csv'
import { ENCODINGS, readSpreadsheet, type Encoding, type Grid } from '@/shared/lib/spreadsheet'
import {
  guessField,
  IMPORT_FIELDS,
  parseCurrency,
  parseNumber,
  type ImportField,
} from '@/shared/lib/importFields'
import { useDataStore, type ProductInput } from '@/data/store'
import type { VariationRow } from '@/features/products/model/product'
import { t } from '@/shared/i18n'

export interface ImportedLine {
  /** The product this row landed on, matched or just created. */
  variation: VariationRow
  quantity: number
  unitCost: number | null
  currency: 'USD' | 'UZS' | null
  /** True when the row had no product behind it and one was created. */
  created?: boolean
}

/** A row that could not become anything, and why. */
interface Rejected {
  row: number
  code: string
  reason: string
}

/**
 * Loading a supplier's spreadsheet onto a document, as the reference product
 * does it: a **page** of its own, in three steps — choose the file, match its
 * columns, import.
 *
 * A page rather than a dialog because of step 2. A supplier's export runs to
 * twenty-odd columns and every one needs a decision; inside a modal that is a
 * strip of selects scrolling sideways in a box, which is exactly the screen
 * where somebody most needs to see the whole thing at once.
 *
 * A row matching a product we carry becomes a line on the document. A row that
 * matches nothing can **create** the product, which is what the reference's
 * generate-a-barcode and generate-an-SKU switches are for — but only when that
 * is switched on, because a catalogue that grows silently from delivery notes
 * fills up with duplicates of things somebody mistyped.
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
  onImport: (lines: ImportedLine[]) => void
}) {
  const variations = useDataStore((s) => s.variations)
  const categories = useDataStore((s) => s.categories)
  const brands = useDataStore((s) => s.brands)
  const createProduct = useDataStore((s) => s.createProduct)

  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [grid, setGrid] = useState<Grid>([])
  const [encoding, setEncoding] = useState<Encoding>('utf-8')
  const [confidence, setConfidence] = useState(1)
  const [isCsv, setIsCsv] = useState(false)
  const [hasHeader, setHasHeader] = useState(true)
  const [fallbackCurrency, setFallbackCurrency] = useState<'USD' | 'UZS'>('USD')
  const [createMissing, setCreateMissing] = useState(false)
  const [generateBarcode, setGenerateBarcode] = useState(false)
  const [generateSku, setGenerateSku] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState<string>(categories[0]?.id ?? '')
  const [mapping, setMapping] = useState<ImportField[]>([])
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
  const at = (field: ImportField) => mapping.lastIndexOf(field)
  const cell = (row: string[], field: ImportField) => {
    const index = at(field)
    return index > -1 ? (row[index] ?? '').trim() : ''
  }

  /**
   * What the file amounts to: the rows that match something, the rows that
   * would have to create something, and the rows that cannot become either.
   */
  const plan = useMemo(() => {
    const byBarcode = new Map(variations.filter((v) => v.barcode).map((v) => [v.barcode!, v]))
    const bySku = new Map(variations.map((v) => [v.sku.toLowerCase(), v]))

    const matched: string[][] = []
    const creatable: string[][] = []
    const rejected: Rejected[] = []

    body.forEach((row, index) => {
      const number = index + (hasHeader ? 2 : 1)
      const barcode = cell(row, 'barcode')
      const sku = cell(row, 'sku')
      const code = barcode || sku
      const found = byBarcode.get(barcode) ?? bySku.get(sku.toLowerCase())

      if (found) {
        matched.push(row)
        return
      }
      if (!code && !cell(row, 'productName')) return

      const name = cell(row, 'productName')
      if (!name) {
        rejected.push({
          row: number,
          code,
          reason: 'no product of ours, and no name to create one',
        })
        return
      }
      if (!sku && !generateSku) {
        rejected.push({
          row: number,
          code: code || name,
          reason: 'no SKU, and none being generated',
        })
        return
      }
      creatable.push(row)
    })

    return { matched, creatable, rejected }
  }, [body, mapping, variations, hasHeader, generateSku])

  const identified = at('barcode') > -1 || at('sku') > -1
  const willCreate = createMissing ? plan.creatable.length : 0
  const willAdd = plan.matched.length + willCreate
  const skipped = plan.rejected.length + (createMissing ? 0 : plan.creatable.length)

  const unmapped = IMPORT_FIELDS.filter(
    (field) => field.value !== 'ignore' && !mapping.includes(field.value),
  )

  const labelFor = (field: ImportField) => {
    const spec = IMPORT_FIELDS.find((f) => f.value === field)
    if (!spec) return field
    return spec.value === 'quantity' ? quantityLabel : spec.label
  }

  /** Builds the lines, creating products for the rows that need one. */
  const run = () => {
    const byBarcode = new Map(variations.filter((v) => v.barcode).map((v) => [v.barcode!, v]))
    const bySku = new Map(variations.map((v) => [v.sku.toLowerCase(), v]))

    const lineFrom = (row: string[], variation: VariationRow, created = false): ImportedLine => {
      const price = parseNumber(cell(row, 'price'))
      return {
        variation,
        quantity: at('quantity') > -1 ? (parseNumber(cell(row, 'quantity')) ?? 0) : 1,
        unitCost: price,
        // The file's own currency column wins; the setting on step 1 is what a
        // file without one is read as.
        currency:
          parseCurrency(cell(row, 'currency')) ?? (price === null ? null : fallbackCurrency),
        created,
      }
    }

    const lines: ImportedLine[] = []

    for (const row of plan.matched) {
      const found = byBarcode.get(cell(row, 'barcode')) ?? bySku.get(cell(row, 'sku').toLowerCase())
      if (found) lines.push(lineFrom(row, found))
    }

    if (createMissing) {
      let counter = variations.length
      for (const row of plan.creatable) {
        counter += 1
        const price = parseNumber(cell(row, 'price')) ?? 0
        const categoryName = cell(row, 'category')
        const category =
          categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase()) ??
          categories.find((c) => c.id === newCategoryId) ??
          categories[0]
        const supplierName = cell(row, 'supplier')
        const brand = brands.find((b) => b.name.toLowerCase() === supplierName.toLowerCase())
        const makes = cell(row, 'make')
          .split(/[,;]/)
          .map((v) => v.trim())
          .filter(Boolean)

        const input: ProductInput = {
          name: cell(row, 'productName'),
          description: cell(row, 'description') || null,
          categoryId: category?.id ?? '',
          brandId: brand?.id ?? null,
          manufacturer: cell(row, 'manufacturer') || null,
          unit: (cell(row, 'unit') || 'pcs') as ProductInput['unit'],
          vehicleMakes: makes,
          vehicleModels: cell(row, 'model')
            .split(/[,;]/)
            .map((v) => v.trim())
            .filter(Boolean),
          options: [],
          status: 'active',
          variations: [
            {
              name: cell(row, 'variationName') || undefined,
              optionValues: [],
              // Generated only when asked for, and only when the file has none.
              sku: cell(row, 'sku') || `SKU-${String(counter).padStart(5, '0')}`,
              barcode:
                cell(row, 'barcode') ||
                (generateBarcode ? `46${String(Date.now() + counter).slice(-11)}` : null),
              partSide: cell(row, 'partSide') || null,
              oem: cell(row, 'oem') || null,
              cargoWeightKg: parseNumber(cell(row, 'cargoWeightKg')),
              cargoSize: cell(row, 'cargoSize') || null,
              costPrice: price,
              costCurrency: parseCurrency(cell(row, 'currency')) ?? fallbackCurrency,
              salePrice: parseNumber(cell(row, 'salePrice')) ?? 0,
              saleCurrency: 'UZS',
              wholesalePrice: null,
              wholesaleCurrency: 'UZS',
              discountPrice: null,
              // Nothing on a shelf yet: the document about to carry it is what
              // puts it there.
              stockByLocation: [],
              lowStockThreshold: null,
              shelfAddress: cell(row, 'shelfAddress') || null,
              imageUrl: null,
              status: 'active',
            },
          ],
        }

        const product = createProduct(input)
        const created = useDataStore.getState().variations.find((v) => v.productId === product.id)
        if (created) lines.push(lineFrom(row, created, true))
      }
    }

    onImport(lines)
  }

  const downloadTemplate = () =>
    downloadCsv(
      'product-import-template.csv',
      ['Barcode', 'SKU', 'Product name', quantityLabel, 'Supplier price', 'Currency', 'Category'],
      [
        ['4600000000000', 'SKU-00001', 'Timing belt A50', '10', '12.50', 'USD', 'Engine > Filters'],
        ['', 'SKU-00002-L', 'Coolant Pro74', '4', '250000', 'UZS', 'Consumables'],
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
              <CardTitle>{t('Settings')}</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('Supplier price currency')}
                required
                hint={t('What a price is read as when the file has no currency column of its own')}
              >
                {(p) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={fallbackCurrency}
                    onChange={(value) => setFallbackCurrency(value as 'USD' | 'UZS')}
                    options={[
                      { value: 'USD', label: t('USD') },
                      { value: 'UZS', label: t('UZS') },
                    ]}
                  />
                )}
              </Field>

              <Field
                label={t('Example file')}
                hint={t('The columns we can read, ready to fill in')}
              >
                {() => (
                  <Button variant="secondary" className="w-full" onClick={downloadTemplate}>
                    <FileDown />
                    {t('Download a template')}
                  </Button>
                )}
              </Field>

              {/* Only a CSV has an encoding to get wrong — an xlsx carries its
                  own inside the file. */}
              {isCsv ? (
                <Field
                  label={t('Encoding')}
                  className="sm:col-span-2"
                  hint={t(
                    'Excel on a Russian Windows saves CSV as windows-1251; read as UTF-8 that file is a column of question marks',
                  )}
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
                <p className="text-fg-muted mb-1 text-sm">{t('Upload a spreadsheet')}</p>
                <label className="border-border hover:border-border-strong rounded-card flex cursor-pointer flex-col items-center gap-2 border border-dashed p-10 text-center">
                  <Upload className="text-fg-subtle size-6" />
                  <span className="text-fg text-sm font-medium">
                    {t('Drop a file here, or click to choose one')}
                  </span>
                  <span className="text-fg-subtle text-2xs">
                    {t('Excel (.xlsx), or a comma-, semicolon- or tab-separated .csv')}
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
                    {file.name} · {formatNumber(grid.length)} {t('rows')}
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
              <CardTitle>{t('Spreadsheet settings')}</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Toggle
                label={t('First row is a heading')}
                hint={t(
                  'Turn this on when the first row names the columns rather than holding a product.',
                )}
                checked={hasHeader}
                onChange={setHasHeader}
              />
              <Toggle
                label={t('Create products we do not carry')}
                hint={t(
                  'Rows matching nothing become new products. Off, they are listed and skipped.',
                )}
                checked={createMissing}
                onChange={setCreateMissing}
              />
              <Toggle
                label={t('Generate a barcode')}
                hint={t('For a product being created whose row has no barcode of its own.')}
                checked={generateBarcode}
                onChange={setGenerateBarcode}
                disabled={!createMissing}
              />
              <Toggle
                label={t('Generate an SKU')}
                hint={t('For a product being created whose row has no SKU of its own.')}
                checked={generateSku}
                onChange={setGenerateSku}
                disabled={!createMissing}
              />

              {createMissing ? (
                <Field
                  label={t('Category for new products')}
                  className="sm:col-span-2 xl:col-span-4"
                  hint={t('Used when the file has no category column, or names one we do not have')}
                >
                  {(p) => (
                    <Select
                      {...p}
                      className="w-full sm:max-w-md"
                      value={newCategoryId || undefined}
                      onChange={setNewCategoryId}
                      options={categories.map((c) => ({ value: c.id as string, label: c.path }))}
                    />
                  )}
                </Field>
              ) : null}
            </CardBody>
          </Card>
        </>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader className="flex-col items-stretch gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{t('What each column holds')}</CardTitle>
              <span className="text-fg-muted text-sm">
                {formatNumber(willAdd)} of {formatNumber(body.length)} {t('rows will be added')}
              </span>
            </div>
            {unmapped.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-fg-subtle text-2xs">{t('Not mapped yet:')}</span>
                {unmapped.map((field) => (
                  <span
                    key={field.value}
                    className="bg-success-soft text-success text-2xs rounded-full px-2 py-0.5"
                  >
                    {labelFor(field.value)}
                  </span>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardBody className="p-0">
            <div className="scroll-x-quiet overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="bg-canvas">
                    <th className="text-fg-subtle text-2xs w-10 p-2 text-right font-normal">#</th>
                    {headings.map((heading, index) => (
                      <th key={index} className="p-2 text-left align-top font-normal">
                        <p className="text-fg-subtle text-2xs mb-1 max-w-44 truncate">
                          {hasHeader
                            ? heading || t('Column {p0}', { p0: index + 1 })
                            : t('Column {p0}', { p0: index + 1 })}
                        </p>
                        <Select
                          className="w-44"
                          aria-label={t('What column {p0} holds', { p0: index + 1 })}
                          value={mapping[index] ?? 'ignore'}
                          onChange={(value) =>
                            setMapping((current) =>
                              current.map((f, i) => (i === index ? (value as ImportField) : f)),
                            )
                          }
                          options={IMPORT_FIELDS.map((field) => ({
                            value: field.value,
                            label:
                              labelFor(field.value) +
                              (field.identifies ? ' *' : field.creationOnly ? ' (new only)' : ''),
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
                      {row.map((value, i) => (
                        <td key={i} className="text-fg-muted max-w-44 truncate p-2">
                          {value}
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
                {t(
                  'Mark the column holding the barcode or the SKU — it is what a row is matched on.',
                )}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('Ready to import')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-fg flex items-center gap-2 text-sm">
              <Check className="text-success size-4" />
              {formatNumber(plan.matched.length)} {t('rows matched a product we already carry.')}
            </p>

            {willCreate > 0 ? (
              <p className="text-fg flex items-center gap-2 text-sm">
                <Plus className="text-info size-4" />
                {formatNumber(willCreate)} {t('rows will create a new product first.')}
              </p>
            ) : null}

            {skipped > 0 ? (
              <div className="border-border rounded-card border p-3">
                <p className="text-warning flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4" />
                  {formatNumber(skipped)} {t('rows will be skipped')}
                </p>
                {!createMissing && plan.creatable.length > 0 ? (
                  <p className="text-fg-subtle text-2xs mt-1">
                    {formatNumber(plan.creatable.length)}{' '}
                    {t(
                      'of them could be created — turn on “Create products we do not carry” on the first step.',
                    )}
                  </p>
                ) : null}
                <ul className="text-fg-muted mt-2 max-h-56 space-y-0.5 overflow-y-auto text-sm">
                  {plan.rejected.slice(0, 100).map((miss) => (
                    <li key={`${miss.row}-${miss.code}`}>
                      {t('Row')} {miss.row}: <span className="font-mono">{miss.code || '—'}</span> —{' '}
                      {miss.reason}
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
            ? t('Excel (.xlsx) or .csv')
            : t('{p0} of {p1} rows will be added', {
                p0: formatNumber(willAdd),
                p1: formatNumber(body.length),
              })}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to={backTo}>{t('Cancel')}</Link>
          </Button>
          {step < 3 ? (
            <Button
              variant="primary"
              disabled={grid.length === 0 || (step === 2 && !identified)}
              title={
                step === 2 && !identified
                  ? t('Say which column holds the barcode or SKU')
                  : undefined
              }
              onClick={() => setStep(step + 1)}
            >
              {t('Continue')}
            </Button>
          ) : (
            <Button variant="primary" disabled={willAdd === 0} onClick={run}>
              {t('Add')} {formatNumber(willAdd)} {t('products')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** One of the reference product's switch cards. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      className={`border-border rounded-card flex items-start justify-between gap-4 border p-4 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-fg text-sm font-medium">{label}</p>
        <p className="text-fg-subtle text-2xs mt-0.5">{hint}</p>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
