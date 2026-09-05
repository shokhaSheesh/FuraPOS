import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { ListQuery, Paginated } from '@/shared/types'
import type { Sale, SaleLine } from '../model/sale'

export const saleKeys = {
  all: ['sales'] as const,
  list: (query: ListQuery) => [...saleKeys.all, 'list', query] as const,
}

export interface Client {
  id: string
  name: string
  phone: string
  debt: number
}

export function useSales(query: ListQuery) {
  return useQuery({
    queryKey: saleKeys.list(query),
    queryFn: () => http.get<Paginated<Sale>>('/sales', query),
    placeholderData: (previous) => previous,
  })
}

export function useClients(search: string) {
  return useQuery({
    queryKey: ['clients', search],
    queryFn: () => http.get<Paginated<Client>>('/clients', { search, pageSize: 20 }),
  })
}

export interface CreateSalePayload {
  clientId: string | null
  locationId: string
  paymentMethod: Sale['paymentMethod']
  comment: string
  paid: number
  lines: SaleLine[]
  status: 'draft' | 'completed' | 'postponed'
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSalePayload) => http.post<Sale>('/sales', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: saleKeys.all }),
  })
}
