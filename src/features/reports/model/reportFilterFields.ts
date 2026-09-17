import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { sourceLabel, type ReportDefinition, type ReportSource } from './report'

/** The report generator list's search panel. */
export const REPORT_FILTER_OVERRIDES: FieldOverrides<ReportDefinition> = {
  name: { type: 'text' },
  source: { type: 'options', optionLabel: (value) => sourceLabel(value as ReportSource) },
  createdBy: { type: 'options' },
}
