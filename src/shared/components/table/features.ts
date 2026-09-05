import {
  columnVisibilityFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'

/**
 * Per-column presentation metadata. Alignment is a rule, not a per-screen
 * choice: numbers and money right, everything else left (DESIGN_RULES § 2.3).
 */
export interface AppColumnMeta {
  align?: 'left' | 'right'
  /** Renders the header label but keeps it visually hidden (actions column). */
  hideHeaderLabel?: boolean
}

/**
 * The feature set every list table registers. TanStack Table v9 is opt-in per
 * feature, so this is the single place that decides what our tables can do.
 *
 * There is deliberately no sortedRowModel: sorting and pagination are always
 * done by the API, because these tables show one page of a larger result.
 */
export const tableFeatureSet = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  columnMeta: {} as AppColumnMeta,
})

export type AppTableFeatures = typeof tableFeatureSet

/**
 * Column definitions for a list table. Screens import this, never the raw
 * TanStack types — it keeps them insulated from the library.
 */
export type TableColumn<TData extends RowData> = ColumnDef<AppTableFeatures, TData, any>
