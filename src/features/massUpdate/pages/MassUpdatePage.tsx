import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  PencilLine,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Steps } from '@/shared/components/Steps'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Popover } from '@/shared/ui/Popover'
import { Select } from '@/shared/ui/Select'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'
import { downloadCsv } from '@/shared/lib/csv'
import { formatDateTime, formatNumber } from '@/shared/lib/format'
import { readSpreadsheet } from '@/shared/lib/spreadsheet'
import { useSession } from '@/app/providers/SessionProvider'
import { useDataStore } from '@/data/store'
import {
  ACTIONS,
  KEY_TYPES,
  SKIP,
  actionAllowed,
  actionSpec,
  checkKeys,
  guessRole,
  keyLabel,
  planMassUpdate,
  problems,
  type ColumnRole,
  type Currency,
  type KeyCheck,
  type MassUpdateRecord,
} from '../model/massUpdate'
import { t } from '@/shared/i18n'

type Step = 1 | 2 | 3

/**
 * Settings → Mass update — OX's «Массовое обновление инф. товаров».
 *
 * Three steps, as OX has them: the file, what each column is, and a check of
 * how many rows will be found before anything is written. The run itself is a
 * single store write, kept in the history below with what it changed.
 */
export default function MassUpdatePage() {
  const { can } = useSession()
  const canSeeCost = can('products.cost.view')
  const variations = useDataStore((s) => s.variations)
  const categories = useDataStore((s) => s.categories)
  const brands = useDataStore((s) => s.brands)
  const locations = useDataStore((s) => s.locations)
  const history = useDataStore((s) => s.massUpdates)
  const presets = useDataStore((s) => s.massUpdatePresets)
  const applyMassUpdate = useDataStore((s) => s.applyMassUpdate)
  const savePreset = useDataStore((s) => s.saveMassUpdatePreset)

  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [grid, setGrid] = useState<string[][] | null>(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [check, setCheck] = useState<KeyCheck | null>(null)
  const [done, setDone] = useState<MassUpdateRecord | null>(null)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')

  const width = grid ? Math.max(...grid.map((row) => row.length)) : 0
  const headings = hasHeader && grid ? grid[0]! : []
  const rows = useMemo(() => (grid ? grid.slice(hasHeader ? 1 : 0) : []), [grid, hasHeader])
  const issues = problems(roles)

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { grid: read } = await readSpreadsheet(file)
      const clean = read.filter((row) => row.some((cell) => cell.trim()))
      if (clean.length === 0) {
        toast.error(t('The file is empty, or it could not be read'))
        return
      }
      setFileName(file.name)
      setGrid(clean)
      setHasHeader(true)
      const columns = Math.max(...clean.map((row) => row.length))
      setRoles(
        Array.from({ length: columns }, (_, index) => {
          const role = guessRole(clean[0]![index] ?? '')
          // Prices are nearly always in sums; the picker still lets it be changed.
          return role.kind === 'action' && actionSpec(role.action).needsCurrency
            ? { ...role, currency: 'UZS' as const }
            : role
        }),
      )
      setCheck(null)
    } catch {
      toast.error(t('That file could not be read — use .csv, .xlsx or .xls'))
    }
  }

  const setRole = (index: number, role: ColumnRole) =>
    setRoles((current) => current.map((entry, i) => (i === index ? role : entry)))

  const runCheck = () => setCheck(checkKeys(rows, roles, variations))

  const goTo = (next: Step) => {
    if (next >= 2 && !grid) return toast.error(t('Choose a file first'))
    if (next === 3 && issues.length) {
      setStep(2)
      return toast.error(t('Fix the columns first'))
    }
    if (next === 3) setCheck(checkKeys(rows, roles, variations))
    setStep(next)
  }

  const run = () => {
    const plan = planMassUpdate({ rows, roles, variations, categories, brands })
    const record = applyMassUpdate({ fileName, totalRows: rows.length, plan })
    setDone(record)
    toast.success(t('Update finished'))
  }

  const reset = () => {
    setStep(1)
    setFileName('')
    setGrid(null)
    setRoles([])
    setCheck(null)
    setDone(null)
  }

  const downloadTemplate = () => {
    const examples = variations.filter((v) => v.barcode).slice(0, 2)
    downloadCsv(
      'mass-update-template.csv',
      ['Barcode', 'Sale price', 'Product name'],
      examples.map((v) => [v.barcode, v.salePrice, v.productName]),
    )
  }

  const keyTags = roles.flatMap((role) => (role.kind === 'key' ? [keyLabel(role.keyType)] : []))
  const actionTags = roles.flatMap((role) => {
    if (role.kind !== 'action') return []
    const spec = actionSpec(role.action)
    const extra = role.currency
      ? ` · ${role.currency}`
      : role.locationId
        ? ` · ${locations.find((l) => l.id === role.locationId)?.name ?? ''}`
        : ''
    return [`${spec.label}${extra}`]
  })

  return (
    <>
      <PageHeader
        title={t('Mass update')}
        description={t(
          'Change many products at once from a spreadsheet — prices, names, categories, stock and more.',
        )}
        below={
          <Steps
            steps={['File', 'Columns', 'Review and run']}
            current={step}
            onSelect={(n) => (done ? undefined : goTo(n as Step))}
            selectable
            wide
          />
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {step === 1 ? (
            <FileStep
              fileName={fileName}
              grid={grid}
              hasHeader={hasHeader}
              onHasHeader={setHasHeader}
              onFile={loadFile}
              onClear={reset}
              onTemplate={downloadTemplate}
              onNext={() => goTo(2)}
            />
          ) : null}

          {step === 2 && grid ? (
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>{t('What is in each column')}</CardTitle>
                  <p className="text-fg-subtle text-2xs mt-0.5">
                    {t(
                      'At least one key column — it finds the product — and one column of new values. Leave the rest as “Don’t use”.',
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {presets.length ? (
                    <Select
                      className="w-56"
                      aria-label={t('Load a saved mapping')}
                      placeholder={t('Load a saved mapping')}
                      value={undefined}
                      onChange={(id) => {
                        const preset = presets.find((p) => p.id === id)
                        if (!preset) return
                        setHasHeader(preset.hasHeader)
                        setRoles(Array.from({ length: width }, (_, i) => preset.roles[i] ?? SKIP))
                        toast.success(t('Mapping “{name}” applied', { name: preset.name }))
                      }}
                      options={presets.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPresetName('')
                      setSavingPreset(true)
                    }}
                  >
                    {t('Save mapping')}
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="border-border rounded-control scroll-x-quiet overflow-x-auto border">
                  <table className="border-collapse text-sm">
                    <thead>
                      <tr>
                        {Array.from({ length: width }, (_, index) => {
                          const role = roles[index] ?? SKIP
                          return (
                            <th
                              key={index}
                              className={cn(
                                'border-border min-w-52 border-r p-2 text-left align-top font-normal last:border-r-0',
                                role.kind === 'key' && 'bg-info-soft',
                                role.kind === 'action' && 'bg-success-soft',
                              )}
                            >
                              <p className="text-fg-subtle text-2xs mb-1 truncate">
                                {headings[index] || t('Column {p0}', { p0: index + 1 })}
                              </p>
                              <RolePicker
                                role={role}
                                roles={roles}
                                canSeeCost={canSeeCost}
                                onChange={(next) => setRole(index, next)}
                              />
                              {role.kind === 'action' && actionSpec(role.action).needsCurrency ? (
                                <Select<Currency>
                                  className="mt-1.5 h-8 w-full"
                                  aria-label={t('Currency')}
                                  placeholder={t('Currency')}
                                  value={role.currency}
                                  onChange={(currency) => setRole(index, { ...role, currency })}
                                  options={[
                                    { value: 'UZS', label: t('UZS') },
                                    { value: 'USD', label: t('USD') },
                                  ]}
                                />
                              ) : null}
                              {role.kind === 'action' && actionSpec(role.action).needsLocation ? (
                                <Select
                                  className="mt-1.5 h-8 w-full"
                                  aria-label={t('Location')}
                                  placeholder={t('At which location')}
                                  value={role.locationId}
                                  onChange={(locationId) => setRole(index, { ...role, locationId })}
                                  options={locations.map((l) => ({ value: l.id, label: l.name }))}
                                />
                              ) : null}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-border border-t">
                          {Array.from({ length: width }, (_, index) => (
                            <td
                              key={index}
                              className={cn(
                                'border-border text-fg max-w-52 truncate border-r px-2 py-1.5 last:border-r-0',
                                (roles[index] ?? SKIP).kind === 'skip' && 'text-fg-subtle',
                              )}
                            >
                              {row[index] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-fg-subtle text-2xs">
                  {t('Showing')} {formatNumber(Math.min(8, rows.length))} of{' '}
                  {formatNumber(rows.length)} {t('rows')}
                </p>

                {issues.length ? (
                  <div className="border-warning/30 bg-warning-soft rounded-control flex gap-2 border p-3 text-sm">
                    <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="text-fg font-medium">{t('Before going on, fix:')}</p>
                      <ul className="text-fg-muted mt-1 list-disc pl-4">
                        {issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    {t('Back')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={issues.length > 0}
                    onClick={() => goTo(3)}
                  >
                    {t('Next')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {step === 3 && grid ? (
            done ? (
              <ResultCard record={done} onNew={reset} />
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('What will be done')}</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <p className="text-fg-muted">
                      {t('Rows:')} <strong className="text-fg">{formatNumber(rows.length)}</strong>{' '}
                      from <span className="text-fg">{fileName}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {keyTags.map((tag) => (
                        <Badge key={`k-${tag}`} tone="info">
                          <Search className="mr-1 inline size-3" />
                          {t('Find by')} {tag}
                        </Badge>
                      ))}
                      {actionTags.map((tag) => (
                        <Badge key={`a-${tag}`} tone="success">
                          <PencilLine className="mr-1 inline size-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader className="flex items-center justify-between gap-2">
                    <CardTitle>{t('Key check')}</CardTitle>
                    <Button type="button" variant="ghost" size="sm" onClick={runCheck}>
                      <RefreshCw />
                      {t('Check again')}
                    </Button>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {check ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Tile label={t('Rows')} value={check.total} />
                          <Tile
                            label={t('Found')}
                            value={check.found}
                            tone={check.found > 0 ? 'success' : 'danger'}
                          />
                          <Tile
                            label={t('Not found')}
                            value={check.total - check.found}
                            tone={check.total - check.found > 0 ? 'warning' : undefined}
                          />
                        </div>
                        {check.found === 0 ? (
                          <p className="text-danger text-sm">
                            {t(
                              'No row is found by the chosen key — running now would change nothing. Check the key column and its values.',
                            )}
                          </p>
                        ) : check.found === check.total ? (
                          <p className="text-success flex items-center gap-1.5 text-sm">
                            <CheckCircle2 className="size-4" />
                            {t('Every row is found — ready to run.')}
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-fg-muted text-sm">
                              {t(
                                'Rows that are not found are simply skipped — they do not stop the run.',
                              )}
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                downloadCsv(
                                  'not-found.csv',
                                  ['Key'],
                                  check.notFound.map((value) => [value]),
                                )
                              }
                            >
                              <Download />
                              {t('Download the list')}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-fg-subtle text-sm">
                        {t('Checking how many rows are found…')}
                      </p>
                    )}
                  </CardBody>
                </Card>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                    {t('Back')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!check || check.found === 0}
                    onClick={run}
                  >
                    <RefreshCw />
                    {t('Update')}
                  </Button>
                </div>
              </>
            )
          ) : null}

          <HistoryCard records={history} />
        </div>

        <InfoPanel />
      </div>

      <Modal
        open={savingPreset}
        onOpenChange={setSavingPreset}
        title={t('Save this mapping')}
        description={t('Load it next time a file arrives in the same shape.')}
        primary={{
          label: t('Save'),
          disabled: !presetName.trim(),
          onClick: () => {
            savePreset({ name: presetName.trim(), roles, hasHeader })
            setSavingPreset(false)
            toast.success(t('Mapping saved'))
          },
        }}
      >
        <Input
          autoFocus
          aria-label={t('Mapping name')}
          placeholder={t('Weekly price list')}
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
        />
      </Modal>
    </>
  )
}

/* --- step 1 ---------------------------------------------------------------- */

function FileStep({
  fileName,
  grid,
  hasHeader,
  onHasHeader,
  onFile,
  onClear,
  onTemplate,
  onNext,
}: {
  fileName: string
  grid: string[][] | null
  hasHeader: boolean
  onHasHeader: (value: boolean) => void
  onFile: (file: File | undefined) => void
  onClear: () => void
  onTemplate: () => void
  onNext: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const width = grid ? Math.max(...grid.map((row) => row.length)) : 0

  return (
    <Card>
      <CardBody className="space-y-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setOver(false)
            onFile(event.dataTransfer.files[0])
          }}
          className={cn(
            'rounded-card flex w-full flex-col items-center gap-2 border-2 border-dashed px-4 py-10 text-center transition-colors',
            over ? 'border-primary bg-primary-soft' : 'border-border hover:border-border-strong',
          )}
        >
          <FileUp className="text-primary size-8" />
          <span className="text-fg text-sm font-medium">
            {t('Drop a CSV or Excel file here, or click to choose one')}
          </span>
          <span className="text-fg-subtle text-2xs">
            {t('.csv, .xlsx and .xls — the encoding and separator are worked out for you')}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <div className="text-center">
          <Button type="button" variant="link" size="sm" onClick={onTemplate}>
            <Download />
            {t('Download a template')}
          </Button>
        </div>

        {grid ? (
          <div className="border-border rounded-control space-y-3 border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">
                <FileSpreadsheet className="mr-1 inline size-3" />
                {fileName}
              </Badge>
              <span className="text-fg-muted text-sm">
                {t('Rows:')}{' '}
                <strong className="text-fg">
                  {formatNumber(grid.length - (hasHeader ? 1 : 0))}
                </strong>
              </span>
              <label className="text-fg flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  aria-label={t('The first row is a heading')}
                  checked={hasHeader}
                  onCheckedChange={onHasHeader}
                />
                {t('The first row is a heading')}
              </label>
              <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
                <X />
                {t('Remove')}
              </Button>
            </div>
            <div className="scroll-x-quiet overflow-x-auto">
              <table className="border-collapse text-xs">
                <tbody>
                  {grid.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex} className={cn(hasHeader && rowIndex === 0 && 'opacity-50')}>
                      {Array.from({ length: width }, (_, index) => (
                        <td
                          key={index}
                          className="border-border max-w-52 truncate border px-2 py-1"
                        >
                          {row[index] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="text-right">
          <Button type="button" variant="primary" disabled={!grid} onClick={onNext}>
            {t('Next')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

/* --- pieces ---------------------------------------------------------------- */

/**
 * What one column is: nothing, a key that finds the product, or a field it
 * overwrites. A field the chosen key cannot reach is shown but not offered.
 */
function RolePicker({
  role,
  roles,
  canSeeCost,
  onChange,
}: {
  role: ColumnRole
  roles: ColumnRole[]
  canSeeCost: boolean
  onChange: (role: ColumnRole) => void
}) {
  const [open, setOpen] = useState(false)
  const label =
    role.kind === 'key'
      ? `Key: ${keyLabel(role.keyType)}`
      : role.kind === 'action'
        ? actionSpec(role.action).label
        : 'Don’t use'
  const pick = (next: ColumnRole) => {
    onChange(next)
    setOpen(false)
  }
  // Keys are judged without this column's own role, so changing it is never blocked by itself.
  const others = roles.filter((entry) => entry !== role)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="max-h-80 w-64 overflow-y-auto p-1"
      trigger={
        <button
          type="button"
          className="rounded-control border-border bg-surface text-fg hover:border-border-strong flex h-8 w-full items-center gap-2 border px-2 text-left text-sm"
        >
          {role.kind === 'key' ? <Search className="text-info size-3.5 shrink-0" /> : null}
          {role.kind === 'action' ? (
            <PencilLine className="text-success size-3.5 shrink-0" />
          ) : null}
          <span className="flex-1 truncate">{label}</span>
          <ChevronDown className="text-fg-subtle size-3.5 shrink-0" />
        </button>
      }
    >
      <MenuItem onClick={() => pick(SKIP)} active={role.kind === 'skip'}>
        {t('Don’t use')}
      </MenuItem>
      <MenuHeading>{t('Key — finds the product')}</MenuHeading>
      {KEY_TYPES.map((key) => (
        <MenuItem
          key={key.value}
          active={role.kind === 'key' && role.keyType === key.value}
          onClick={() => pick({ kind: 'key', keyType: key.value })}
        >
          <Search className="text-info size-3.5" />
          {key.label}
        </MenuItem>
      ))}
      <MenuHeading>{t('Update this field')}</MenuHeading>
      {ACTIONS.filter((action) => canSeeCost || !action.costOnly).map((action) => {
        const allowed = actionAllowed(action.value, others)
        return (
          <MenuItem
            key={action.value}
            active={role.kind === 'action' && role.action === action.value}
            disabled={!allowed}
            title={allowed ? undefined : t('Cannot be found by the chosen key')}
            onClick={() =>
              pick({
                kind: 'action',
                action: action.value,
                ...(action.needsCurrency ? { currency: 'UZS' as const } : {}),
              })
            }
          >
            <PencilLine className="text-success size-3.5" />
            {action.label}
          </MenuItem>
        )
      })}
    </Popover>
  )
}

function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-fg-subtle text-2xs px-2 pt-2 pb-1 font-semibold tracking-wide uppercase">
      {children}
    </p>
  )
}

function MenuItem({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  active: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'text-fg flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
        active ? 'bg-primary-soft text-primary' : 'hover:bg-surface-muted',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="border-border rounded-control border px-3 py-2">
      <p className="text-fg-subtle text-2xs">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
          !tone && 'text-fg',
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  )
}

function resultText(result: MassUpdateRecord['result']) {
  const parts = [
    result.products ? `Products: ${formatNumber(result.products)}` : null,
    result.variations ? `Variations: ${formatNumber(result.variations)}` : null,
    result.stock ? `Stock: ${formatNumber(result.stock)}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Nothing updated'
}

function ResultCard({ record, onNew }: { record: MassUpdateRecord; onNew: () => void }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="text-success size-10" />
        <p className="text-fg text-base font-semibold">{t('Update finished')}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {[
            [t('Products'), record.result.products],
            [t('Variations'), record.result.variations],
            [t('Stock'), record.result.stock],
          ]
            .filter(([, count]) => (count as number) > 0)
            .map(([label, count]) => (
              <Badge key={label} tone="success">
                {label}: {formatNumber(count as number)}
              </Badge>
            ))}
          {resultText(record.result) === t('Nothing updated') ? (
            <Badge tone="neutral">{t('Nothing updated')}</Badge>
          ) : null}
        </div>
        {record.correctionNumbers.length ? (
          <p className="text-fg-muted text-sm">
            {t('Stock was changed through')} {record.correctionNumbers.join(', ')}{' '}
            {t('— it shows in the product logs.')}
          </p>
        ) : null}
        {record.errors.length ? (
          <div className="border-warning/30 bg-warning-soft rounded-control w-full max-w-lg border p-3 text-left text-sm">
            <p className="text-fg font-medium">
              {t('Errors:')} {formatNumber(record.errors.length)}
            </p>
            <div className="text-fg-muted mt-1 max-h-40 space-y-0.5 overflow-y-auto">
              {record.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          </div>
        ) : null}
        <Button type="button" variant="primary" onClick={onNew}>
          {t('New update')}
        </Button>
      </CardBody>
    </Card>
  )
}

function HistoryCard({ records }: { records: MassUpdateRecord[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-fg flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <History className="text-fg-muted size-4" />
        {t('History (')}
        {formatNumber(records.length)})
      </button>
      {open ? (
        records.length === 0 ? (
          <p className="text-fg-subtle border-border border-t px-4 py-3 text-sm">
            {t('No updates have been run yet.')}
          </p>
        ) : (
          <div className="border-border scroll-x-quiet overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  {[t('Date'), t('User'), t('File'), t('Rows'), t('Status'), t('Result')].map(
                    (heading) => (
                      <th key={heading} className="px-3 py-2 text-left font-semibold">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-border border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(record.createdAt)}
                    </td>
                    <td className="px-3 py-2">{record.userName}</td>
                    <td className="px-3 py-2">{record.fileName}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(record.totalRows)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={record.status === 'done' ? 'success' : 'danger'}>
                        {record.status === 'done' ? t('Done') : t('Failed')}
                      </Badge>
                    </td>
                    <td className="text-fg-muted px-3 py-2">{resultText(record.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </Card>
  )
}

function InfoPanel() {
  const items = [
    {
      icon: FileSpreadsheet,
      tone: 'text-success bg-success-soft',
      title: t('Update from a file'),
      text: t(
        'Upload Excel or CSV — thousands of products change in one run, without editing each by hand.',
      ),
    },
    {
      icon: Search,
      tone: 'text-info bg-info-soft',
      title: t('Found by a key'),
      text: t('Products are found by barcode, SKU or ID — you say which column holds it.'),
    },
    {
      icon: PencilLine,
      tone: 'text-primary bg-primary-soft',
      title: t('Any field'),
      text: t(
        'Sale and supplier prices, names, categories, brands, makes, storage address, stock and more.',
      ),
    },
    {
      icon: ShieldCheck,
      tone: 'text-warning bg-warning-soft',
      title: t('Safe to run'),
      text: t(
        'Before anything changes you see how many rows are found. Rows not found are skipped, and every run is kept in the history.',
      ),
    },
  ]
  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>{t('What is this?')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {items.map((item) => (
          <div key={item.title} className="flex gap-3">
            <span
              className={cn(
                'rounded-control flex size-8 shrink-0 items-center justify-center',
                item.tone,
              )}
            >
              <item.icon className="size-4" />
            </span>
            <div>
              <p className="text-fg text-sm font-medium">{item.title}</p>
              <p className="text-fg-subtle text-2xs">{item.text}</p>
            </div>
          </div>
        ))}
        <div className="border-border border-t pt-3">
          <p className="text-fg text-sm font-medium">{t('How it works')}</p>
          <ol className="text-fg-muted mt-2 space-y-1.5 text-sm">
            <li>{t('1. Upload the file')}</li>
            <li>{t('2. Say what is in each column')}</li>
            <li>{t('3. Check, then run the update')}</li>
          </ol>
        </div>
      </CardBody>
    </Card>
  )
}
