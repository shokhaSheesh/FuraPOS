import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { ListQuery, Paginated } from '@/shared/types'
import type { Product, VariationRow } from '../model/product'

export const productKeys = {
  all: ['products'] as const,
  variations: (query: ListQuery) => [...productKeys.all, 'variations', query] as const,
  list: (query: ListQuery) => [...productKeys.all, 'list', query] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}

export interface CatalogSummary {
  total: number
  products: number
  active: number
  archived: number
  quantity: number
  saleValue: number
  costValue: number
  zeroStock: number
  withImage: number
}

/** The catalogue: one row per sellable variation. */
export function useVariations(query: ListQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: productKeys.variations(query),
    queryFn: () => http.get<Paginated<VariationRow>>('/variations', query),
    placeholderData: (previous) => previous,
    ...options,
  })
}

/** The parent view: one row per product. */
export function useProducts(query: ListQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => http.get<Paginated<Product>>('/products', query),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => http.get<Product>(`/products/${id}`),
  })
}

export function useCatalogSummary(query: ListQuery) {
  return useQuery({
    queryKey: [...productKeys.all, 'summary', query],
    queryFn: () => http.get<CatalogSummary>('/variations/summary', query),
    placeholderData: (previous) => previous,
  })
}

export function useCatalogStatusCounts(query: ListQuery) {
  return useQuery({
    queryKey: [...productKeys.all, 'status-counts', query],
    queryFn: () => http.get<Record<string, number>>('/variations/status-counts', query),
    placeholderData: (previous) => previous,
  })
}

export function useDeleteVariation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.delete<void>(`/variations/${id}`),
    // No optimistic removal: the row goes only once the server confirms.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
