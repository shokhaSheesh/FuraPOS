import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/lib/http'
import type { ListQuery, Paginated } from '@/shared/types'
import type { Sale, SaleDelivery, SaleLine, SaleStatus } from '../model/sale'

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

export interface SalesSummary {
  count: number
  total: number
  units: number
  debtCount: number
  debtTotal: number
  deliveryCount: number
  deliveryTotal: number
  clients: number
  sellers: number
}

export function useSalesSummary(query: ListQuery) {
  return useQuery({
    queryKey: [...saleKeys.all, 'summary', query],
    queryFn: () => http.get<SalesSummary>('/sales/summary', query),
    placeholderData: (previous) => previous,
  })
}

export function useSale(id: string) {
  return useQuery({
    queryKey: [...saleKeys.all, 'detail', id],
    queryFn: () => http.get<Sale>(`/sales/${id}`),
  })
}

/** Moves a sale along its lifecycle, or records a payment against it. */
export function useUpdateSale(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: { status?: SaleStatus; paid?: number }) =>
      http.patch<Sale>(`/sales/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: saleKeys.all }),
  })
}

export function useSaleStatusCounts(query: ListQuery) {
  return useQuery({
    queryKey: [...saleKeys.all, 'status-counts', query],
    queryFn: () => http.get<Record<string, number>>('/sales/status-counts', query),
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
  channel: Sale['channel']
  comment: string
  paid: number
  lines: SaleLine[]
  delivery: SaleDelivery | null
  expiresAt: string | null
  status: SaleStatus
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSalePayload) => http.post<Sale>('/sales', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: saleKeys.all }),
  })
}
