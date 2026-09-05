import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { ListQuery, Paginated } from '@/shared/types'
import type { Product } from '../model/product'

export const productKeys = {
  all: ['products'] as const,
  list: (query: ListQuery) => [...productKeys.all, 'list', query] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}

export function useProducts(query: ListQuery) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => http.get<Paginated<Product>>('/products', query),
    placeholderData: (previous) => previous,
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.delete<void>(`/products/${id}`),
    // No optimistic removal: the row disappears only once the server confirms
    // (docs/DESIGN_RULES.md § 9.4).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
