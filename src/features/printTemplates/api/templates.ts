import { useMemo } from 'react'
import { useDataStore, type TemplateInput } from '@/data/store'
import { matches } from '@/data/query'
import { kindLabel, type PrintTemplate, type TemplateKind } from '../model/template'

export function usePrintTemplates(filters: { search?: unknown; kind?: unknown } = {}) {
  const templates = useDataStore((s) => s.printTemplates)

  return useMemo(() => {
    const items = templates
      .filter((template) => {
        if (filters.kind && template.kind !== filters.kind) return false
        return matches(
          [template.name, kindLabel(template.kind), template.createdBy],
          filters.search as string | undefined,
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return { data: { items, total: items.length }, isLoading: false }
  }, [templates, filters.kind, filters.search])
}

export function usePrintTemplate(id: string | undefined) {
  const templates = useDataStore((s) => s.printTemplates)
  return useMemo(
    () => ({ data: templates.find((template) => template.id === id), isLoading: false }),
    [templates, id],
  )
}

/** Counts for the filter chips — every kind shows a number, including zero. */
export function useTemplateCounts(): Record<string, number> {
  const templates = useDataStore((s) => s.printTemplates)
  return useMemo(() => {
    const counts: Record<string, number> = { all: templates.length }
    for (const kind of ['label', 'shelf', 'receipt'] as TemplateKind[]) {
      counts[kind] = templates.filter((template) => template.kind === kind).length
    }
    return counts
  }, [templates])
}

export function useTemplateActions() {
  const create = useDataStore((s) => s.createPrintTemplate)
  const update = useDataStore((s) => s.updatePrintTemplate)
  const duplicate = useDataStore((s) => s.duplicatePrintTemplate)
  const remove = useDataStore((s) => s.deletePrintTemplate)

  return useMemo(
    () => ({
      create: (input: TemplateInput) => create(input),
      update: (id: string, input: TemplateInput) => update(id, input),
      duplicate: (id: string) => duplicate(id),
      remove: (id: string) => remove(id),
      isPending: false,
    }),
    [create, update, duplicate, remove],
  )
}

export type { PrintTemplate }
