import type { TableColumn } from '@/shared/components/table/features'
import type { FieldOverrides } from '@/shared/lib/columnFilterFields'
import { CODE_KINDS, kindLabel, type PrintTemplate, type TemplateKind } from './template'

/**
 * Print templates are a grid of cards rather than a table, so there are no
 * columns to read the search panel from. These stand in for them: what each
 * card says about a template, in the order it says it.
 */
export const TEMPLATE_FILTER_COLUMNS: TableColumn<PrintTemplate>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'kind', header: 'Prints' },
  { id: 'width', header: 'Width' },
  { id: 'height', header: 'Height' },
  { accessorKey: 'code', header: 'Code' },
  { id: 'fields', header: 'Fields' },
  { accessorKey: 'createdBy', header: 'Made by' },
  { accessorKey: 'updatedAt', header: 'Last changed' },
]

export const TEMPLATE_FILTER_OVERRIDES: FieldOverrides<PrintTemplate> = {
  name: { type: 'text' },
  kind: { type: 'options', optionLabel: (value) => kindLabel(value as TemplateKind) },
  width: { unit: 'mm', type: 'range', get: (t) => t.widthMm },
  height: { unit: 'mm', type: 'range', get: (t) => t.heightMm },
  code: {
    type: 'options',
    optionLabel: (value) => CODE_KINDS.find((c) => c.value === value)?.label ?? value,
  },
  fields: { type: 'options', get: (t) => t.fields },
  createdBy: { type: 'options' },
}
