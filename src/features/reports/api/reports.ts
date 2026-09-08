import { useMemo } from 'react'
import { useDataStore, type ReportInput } from '@/data/store'
import { matches } from '@/data/query'
import {
  PERIOD_DAYS,
  runReport,
  sourceLabel,
  type ReportDefinition,
  type ReportPeriod,
  type ReportResult,
  type ReportSource,
} from '../model/report'
import { buildSourceRows } from './sources'

export function useReports(filters: { search?: unknown; source?: unknown } = {}) {
  const reports = useDataStore((s) => s.reports)

  return useMemo(() => {
    const items = reports
      .filter((report) => {
        if (filters.source && report.source !== filters.source) return false
        return matches(
          [report.name, sourceLabel(report.source), report.createdBy],
          filters.search as string | undefined,
        )
      })
      // Pinned first — they are the ones somebody runs every week.
      .sort((a, b) => {
        const byPin = Number(b.pinned) - Number(a.pinned)
        return byPin !== 0 ? byPin : a.name.localeCompare(b.name)
      })

    return { data: { items, total: items.length }, isLoading: false }
  }, [reports, filters.source, filters.search])
}

export function useReport(id: string | undefined) {
  const reports = useDataStore((s) => s.reports)
  return useMemo(
    () => ({ data: reports.find((report) => report.id === id), isLoading: false }),
    [reports, id],
  )
}

/**
 * Runs a definition.
 *
 * Nothing is cached and nothing is stored: a report is a question asked of the
 * data as it stands, so re-running it after a sale must give a different
 * answer. The cost of that is why the screen is filter-gated.
 */
export function useRunReport(
  definition: Pick<ReportDefinition, 'source' | 'dimensions' | 'measures'> | undefined,
  period: ReportPeriod,
  enabled: boolean,
): ReportResult | null {
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const receipts = useDataStore((s) => s.receipts)
  const transfers = useDataStore((s) => s.transfers)
  const corrections = useDataStore((s) => s.corrections)
  const clients = useDataStore((s) => s.clients)
  const suppliers = useDataStore((s) => s.suppliers)

  return useMemo(() => {
    if (!enabled || !definition) return null

    const state = { variations, sales, receipts, transfers, corrections, clients, suppliers }
    const rows = buildSourceRows(state as never, definition.source)

    const since = period === 'all' ? null : Date.now() - PERIOD_DAYS[period] * 86_400_000
    const scoped =
      since === null
        ? rows
        : // A row with no date is a "right now" fact — stock on a shelf, money
          // owed — and belongs in every period rather than none.
          rows.filter((row) => row.at === null || new Date(row.at).getTime() >= since)

    return runReport(scoped, definition)
  }, [
    enabled,
    definition,
    period,
    variations,
    sales,
    receipts,
    transfers,
    corrections,
    clients,
    suppliers,
  ])
}

/**
 * A live preview while building.
 *
 * Returns the *whole* result and lets the table show the first few — so the
 * totals row can honestly say what it is the total of. Slicing here would make
 * the footer read as the total of five rows when it is the total of hundreds.
 */
export function usePreview(source: ReportSource, dimensions: string[], measures: string[]) {
  return useRunReport({ source, dimensions, measures }, 'all', measures.length > 0)
}

export function usePinnedReports() {
  const reports = useDataStore((s) => s.reports)
  return useMemo(() => reports.filter((report) => report.pinned), [reports])
}

export function useReportActions() {
  const create = useDataStore((s) => s.createReport)
  const update = useDataStore((s) => s.updateReport)
  const remove = useDataStore((s) => s.deleteReport)
  const setPinned = useDataStore((s) => s.setReportPinned)

  return {
    create: (input: ReportInput) => create(input),
    update: (id: string, input: ReportInput) => update(id, input),
    remove,
    setPinned,
    isPending: false,
  }
}
