import { http, HttpResponse } from 'msw'
import { api } from './api'
import { products } from '../seed'

export interface DashboardSummary {
  revenueToday: number
  revenueChange: number
  salesCount: number
  salesCountChange: number
  averageCheck: number
  averageCheckChange: number
  grossMargin: number
  grossMarginChange: number
  lowStockCount: number
  revenueSeries: { date: string; revenue: number; cost: number }[]
  topProducts: { id: string; name: string; quantity: number; revenue: number }[]
}

export const dashboardHandlers = [
  http.get(api('/dashboard/summary'), () => {
    const revenueSeries = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.now() - (13 - index) * 86_400_000)
      const revenue = 8_000_000 + Math.round(Math.sin(index / 2) * 2_400_000) + index * 120_000
      return {
        date: date.toISOString().slice(0, 10),
        revenue,
        cost: Math.round(revenue * 0.68),
      }
    })

    const summary: DashboardSummary = {
      revenueToday: revenueSeries.at(-1)!.revenue,
      revenueChange: 0.084,
      salesCount: 143,
      salesCountChange: -0.021,
      averageCheck: 78_400,
      averageCheckChange: 0.106,
      grossMargin: 0.317,
      grossMarginChange: 0.012,
      lowStockCount: products.filter(
        (product) =>
          product.lowStockThreshold !== null && product.stock <= product.lowStockThreshold,
      ).length,
      revenueSeries,
      topProducts: products.slice(0, 5).map((product) => ({
        id: product.id,
        name: product.name,
        quantity: 20 + (product.stock % 40),
        revenue: product.salePrice * (20 + (product.stock % 40)),
      })),
    }

    return HttpResponse.json(summary)
  }),
]
