import { z } from 'zod'
import type { Id, IsoDate } from '@/shared/types'

/**
 * A saved report: a table someone described once and can re-run.
 *
 * OX ships seventeen templates behind a five-step wizard. Read closely they are
 * seventeen preset column-combinations over a handful of datasets, so the
 * datasets are what is worth building — a template is then a starting point
 * rather than a feature. Five of OX's seventeen also duplicate screens we
 * already have (seller performance, current stock, stock by supplier), and
 * those are deliberately not repeated here.
 *
 * The shape OX gets right and we keep: a report is a **definition that is
 * saved, shared and re-run**, opened behind a filter gate rather than
 * calculated on navigation.
 */
export type ReportSource = 'sales' | 'stock' | 'movement' | 'money'

export const REPORT_SOURCES: {
  value: ReportSource
  label: string
  hint: string
}[] = [
  { value: 'sales', label: 'Sales', hint: 'Every sale line — what sold, to whom, by whom' },
  { value: 'stock', label: 'Stock', hint: 'What is on the shelf right now, and what it is worth' },
  {
    value: 'movement',
    label: 'Stock movement',
    hint: 'Everything that moved stock: receipts, transfers, corrections, stocktakes',
  },
  { value: 'money', label: 'Money owed', hint: 'What clients owe us and what we owe suppliers' },
]

export const sourceLabel = (source: ReportSource) =>
  REPORT_SOURCES.find((entry) => entry.value === source)?.label ?? source

/**
 * A column you can group by. OX calls these "informational columns"; they are
 * the things a row *is*.
 */
export interface Dimension {
  key: string
  label: string
}

/**
 * A column that gets added up. OX calls these "functional columns".
 *
 * `format` decides how the total is rendered, which is not cosmetic: showing a
 * unit count as money is the kind of mistake a report screen exists to avoid.
 */
export interface Measure {
  key: string
  label: string
  format: 'money' | 'number' | 'percent'
  /** Not a sum — a ratio worked out from the group's totals. */
  derived?: boolean
}

export interface SourceSchema {
  dimensions: Dimension[]
  measures: Measure[]
}

export const SOURCE_SCHEMAS: Record<ReportSource, SourceSchema> = {
  sales: {
    dimensions: [
      { key: 'date', label: 'Day' },
      { key: 'month', label: 'Month' },
      { key: 'product', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'brand', label: 'Brand' },
      { key: 'client', label: 'Client' },
      { key: 'seller', label: 'Seller' },
      { key: 'location', label: 'Location' },
      { key: 'paymentMethod', label: 'Payment method' },
      { key: 'channel', label: 'Channel' },
      { key: 'status', label: 'Status' },
    ],
    measures: [
      { key: 'revenue', label: 'Revenue', format: 'money' },
      { key: 'cost', label: 'Cost', format: 'money' },
      { key: 'margin', label: 'Margin', format: 'money' },
      { key: 'marginRatio', label: 'Margin %', format: 'percent', derived: true },
      { key: 'discount', label: 'Discount given', format: 'money' },
      { key: 'units', label: 'Units', format: 'number' },
      { key: 'sales', label: 'Sales', format: 'number' },
      { key: 'averageCheck', label: 'Average check', format: 'money', derived: true },
    ],
  },
  stock: {
    dimensions: [
      { key: 'product', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'brand', label: 'Brand' },
      { key: 'location', label: 'Location' },
      { key: 'supplier', label: 'Supplier' },
    ],
    measures: [
      { key: 'onHand', label: 'On hand', format: 'number' },
      { key: 'costValue', label: 'Value at cost', format: 'money' },
      { key: 'retailValue', label: 'Value at retail', format: 'money' },
      { key: 'skus', label: 'SKUs', format: 'number' },
    ],
  },
  movement: {
    dimensions: [
      { key: 'date', label: 'Day' },
      { key: 'month', label: 'Month' },
      { key: 'kind', label: 'Document type' },
      { key: 'product', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'location', label: 'Location' },
    ],
    measures: [
      { key: 'inUnits', label: 'Units in', format: 'number' },
      { key: 'outUnits', label: 'Units out', format: 'number' },
      { key: 'netUnits', label: 'Net change', format: 'number' },
      { key: 'documents', label: 'Documents', format: 'number' },
    ],
  },
  money: {
    dimensions: [
      { key: 'party', label: 'Who' },
      { key: 'partyType', label: 'Client or supplier' },
    ],
    measures: [
      { key: 'owedToUs', label: 'Owed to us', format: 'money' },
      { key: 'owedByUs', label: 'Owed by us', format: 'money' },
      { key: 'net', label: 'Net', format: 'money' },
    ],
  },
}

/**
 * How the result is drawn, on top of the table.
 *
 * OX has a whole wizard step for charts; the useful part of it is one field.
 * A chart needs exactly one axis, so it is only offered when the report is
 * broken down by exactly one thing — with two dimensions there is no sensible
 * simple chart, and with none there is a single number, which is not a chart.
 */
export type ReportChart = 'none' | 'bar' | 'line' | 'donut'

export const REPORT_CHARTS: { value: ReportChart; label: string; hint: string }[] = [
  { value: 'none', label: 'No chart', hint: 'Just the table' },
  { value: 'bar', label: 'Bars', hint: 'Comparing things — products, sellers, categories' },
  { value: 'line', label: 'Line', hint: 'A trend over days or months' },
  { value: 'donut', label: 'Donut', hint: 'Share of a total' },
]

/** A chart needs one axis: exactly one break-down column, no more, no less. */
export const canChart = (dimensions: string[]) => dimensions.length === 1

/**
 * Bars past a dozen categories are a picket fence, and a donut past a dozen
 * slices is confetti. The tail is folded into one "Other" slice rather than
 * dropped, so the chart still adds up to the table.
 */
export const CHART_TOP_N = 12

export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

export const PERIOD_DAYS: Record<Exclude<ReportPeriod, 'all'>, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
}

export interface ReportDefinition {
  id: Id
  name: string
  source: ReportSource
  /** Grouping columns, in order — the row's identity. */
  dimensions: string[]
  /** Aggregated columns. */
  measures: string[]
  /** What the report opens on. A person can change it before running. */
  defaultPeriod: ReportPeriod
  chart: ReportChart
  /** Which measure the chart draws. The first one when unset. */
  chartMeasure: string | null
  /**
   * Pinned into the sidebar. OX's «Добавить в меню»; kept because a report
   * somebody runs every Monday should not need finding first.
   */
  pinned: boolean
  createdBy: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

/* --- running one --------------------------------------------------------- */

/** One flat record out of a data source, before grouping. */
export interface SourceRow {
  /** Dimension values, keyed as the schema names them. */
  dims: Record<string, string>
  /** Measure values to be summed. Derived measures are computed after. */
  values: Record<string, number>
  /** When it happened, for period filtering. Null for stock, which is "now". */
  at: IsoDate | null
}

export interface ReportRow {
  key: string
  dims: Record<string, string>
  values: Record<string, number>
}

export interface ReportResult {
  rows: ReportRow[]
  /** Column totals, so the table can carry a footer that adds up. */
  totals: Record<string, number>
  /** How many source records went into it — the honesty check on a big number. */
  sourceRows: number
}

/**
 * Ratios cannot be summed.
 *
 * Averaging an average check across groups, or adding margin percentages
 * together, gives a number that looks plausible and is wrong. Each derived
 * measure is worked out from the group's own totals instead.
 */
function applyDerived(values: Record<string, number>) {
  if ('margin' in values && 'revenue' in values) {
    values.marginRatio = values.revenue === 0 ? 0 : values.margin / values.revenue
  }
  if ('revenue' in values && 'sales' in values) {
    values.averageCheck = values.sales === 0 ? 0 : values.revenue / values.sales
  }
  if ('inUnits' in values && 'outUnits' in values) {
    values.netUnits = values.inUnits - values.outUnits
  }
  if ('owedToUs' in values && 'owedByUs' in values) {
    values.net = values.owedToUs - values.owedByUs
  }
  return values
}

/** Groups source rows by the chosen dimensions and adds up the measures. */
export function runReport(
  rows: SourceRow[],
  definition: Pick<ReportDefinition, 'dimensions' | 'measures'>,
): ReportResult {
  const groups = new Map<string, ReportRow>()
  const totals: Record<string, number> = {}

  for (const row of rows) {
    // No dimensions means one row: the grand total. That is a legitimate
    // report — "what did we take last month" — not an empty state.
    const key = definition.dimensions.map((dim) => row.dims[dim] ?? '—').join(' ⋄ ')
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        dims: Object.fromEntries(definition.dimensions.map((dim) => [dim, row.dims[dim] ?? '—'])),
        values: {},
      }
      groups.set(key, group)
    }
    for (const [measure, value] of Object.entries(row.values)) {
      group.values[measure] = (group.values[measure] ?? 0) + value
      totals[measure] = (totals[measure] ?? 0) + value
    }
  }

  const result = [...groups.values()]
  for (const group of result) applyDerived(group.values)
  applyDerived(totals)

  // Biggest first on the leading measure — a report nobody ordered is a list to
  // read rather than an answer.
  const lead = definition.measures.find((measure) => !isDerived(measure))
  if (lead) result.sort((a, b) => (b.values[lead] ?? 0) - (a.values[lead] ?? 0))

  return { rows: result, totals, sourceRows: rows.length }
}

const DERIVED = new Set(['marginRatio', 'averageCheck', 'netUnits', 'net'])
export const isDerived = (measure: string) => DERIVED.has(measure)

/** Everything the schema knows about a chosen column key. */
export const findMeasure = (source: ReportSource, key: string) =>
  SOURCE_SCHEMAS[source].measures.find((measure) => measure.key === key)

export const findDimension = (source: ReportSource, key: string) =>
  SOURCE_SCHEMAS[source].dimensions.find((dimension) => dimension.key === key)

/** The definition as a sentence, for the list. */
export function describeReport(definition: ReportDefinition): string {
  const measures = definition.measures
    .map((key) => findMeasure(definition.source, key)?.label ?? key)
    .join(', ')
  const dimensions = definition.dimensions
    .map((key) => findDimension(definition.source, key)?.label.toLowerCase() ?? key)
    .join(' and ')
  if (definition.dimensions.length === 0) return `${measures}, in total`
  return `${measures} by ${dimensions}`
}

/* --- validation ---------------------------------------------------------- */

export const reportDraftSchema = z.object({
  name: z.string().min(2, 'Give the report a name'),
  source: z.enum(['sales', 'stock', 'movement', 'money']),
  dimensions: z.array(z.string()),
  measures: z.array(z.string()).min(1, 'Pick at least one thing to measure'),
  defaultPeriod: z.enum(['today', 'week', 'month', 'quarter', 'year', 'all']),
  chart: z.enum(['none', 'bar', 'line', 'donut']),
  chartMeasure: z.string().nullable(),
  pinned: z.boolean(),
})

export type ReportDraft = z.infer<typeof reportDraftSchema>

/** Time reads in date order; everything else reads biggest-first. */
export const isTimeDimension = (dimension: string) => dimension === 'date' || dimension === 'month'

/**
 * The rows a chart should draw: the biggest `CHART_TOP_N`, and what happens to
 * the tail **depends on the chart**.
 *
 * A donut has to add up to the whole, so the tail becomes one "Other" slice. A
 * bar chart is a comparison between things, and an "Other" bar summing 120
 * products towers over every real bar and destroys the comparison it exists to
 * make — so bars drop the tail and the caption says how many were left out.
 *
 * A time dimension is exempt from both and returned in date order: folding
 * March into "Other" because it was a quiet month would be nonsense.
 */
export function chartData(
  result: ReportResult,
  dimension: string,
  measure: string,
  chart: ReportChart = 'bar',
): { label: string; value: number }[] {
  const rows = result.rows.map((row) => ({
    label: row.dims[dimension] ?? '—',
    value: row.values[measure] ?? 0,
  }))

  if (isTimeDimension(dimension)) {
    return [...rows].sort((a, b) => a.label.localeCompare(b.label))
  }

  const sorted = [...rows].sort((a, b) => b.value - a.value)
  if (sorted.length <= CHART_TOP_N) return sorted

  const head = sorted.slice(0, CHART_TOP_N)
  if (chart !== 'donut') return head

  const tail = sorted.slice(CHART_TOP_N)
  return [
    ...head,
    { label: `Other (${tail.length})`, value: tail.reduce((s, r) => s + r.value, 0) },
  ]
}
