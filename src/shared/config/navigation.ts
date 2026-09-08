import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShoppingCart,
  Truck,
  UploadCloud,
  Users,
} from 'lucide-react'
import { paths } from './paths'

export type NavBadge = 'new' | 'beta'

export interface NavItem {
  label: string
  to: string
  /** Grants required to see this item — `view` on the section it opens. */
  permission?: string
  badge?: NavBadge
  /** Exact match only (used for index routes that would otherwise stay active). */
  end?: boolean
  /**
   * Optional heading rendered above this item. Used by Finance, which in OX
   * groups its pages under "ОТЧЕТЫ" and "НАСТРОЙКИ" headings.
   */
  group?: string
}

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  /** Present on single-page sections (Dashboard, Uploads, Support). */
  to?: string
  permission?: string
  badge?: NavBadge
  items?: NavItem[]
}

/**
 * The sidebar, top to bottom. Order, grouping and labels mirror OX System
 * one-for-one — see docs/OX-NAVIGATION-MAP.md for the correspondence.
 * Adding a screen means adding it here and to the router, nowhere else.
 */
export const navigation: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: paths.dashboard,
    permission: 'dashboard.view',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingCart,
    to: paths.sales.orders,
    permission: 'sales.orders.view',
  },
  {
    id: 'products',
    label: 'Products / Services',
    icon: Boxes,
    items: [
      { label: 'Product list', to: paths.products.list, permission: 'products.list.view' },
      { label: 'Transfers', to: paths.products.transfers, permission: 'products.transfers.view' },
      {
        label: 'Corrections',
        to: paths.products.corrections,
        permission: 'products.corrections.view',
      },
      {
        label: 'Stocktaking',
        to: paths.products.stocktaking,
        permission: 'products.stocktaking.view',
      },
      {
        label: 'Goods receipt',
        to: paths.products.goodsReceipt,
        permission: 'products.goodsReceipt.view',
      },
      { label: 'Repricing', to: paths.products.repricing, permission: 'products.repricing.view' },
      {
        label: 'Print templates',
        to: paths.products.printTemplates,
        permission: 'products.printTemplates.view',
      },
      { label: 'Suppliers', to: paths.products.suppliers, permission: 'products.suppliers.view' },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: Truck,
    badge: 'new',
    items: [
      { label: 'Orders', to: paths.procurement.orders, permission: 'procurement.orders.view' },
      {
        label: 'Reorder schedules',
        to: paths.procurement.schedules,
        permission: 'procurement.schedules.view',
      },
    ],
  },
  {
    id: 'personnel',
    label: 'Personnel management',
    icon: Users,
    items: [
      { label: 'Employees', to: paths.personnel.employees, permission: 'personnel.employees.view' },
      { label: 'Access & roles', to: paths.personnel.roles, permission: 'personnel.roles.view' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { label: 'Clients', to: paths.marketing.clients, permission: 'marketing.clients.view' },
      {
        label: 'Promotions',
        to: paths.marketing.promotions,
        permission: 'marketing.promotions.view',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    items: [
      {
        label: 'Report generator',
        to: paths.analytics.reports,
        permission: 'analytics.reportBuilder.view',
      },
      {
        label: 'Product logs',
        to: paths.analytics.productLogs,
        permission: 'analytics.productLogs.view',
      },
      { label: 'Sales report', to: paths.analytics.sales, permission: 'analytics.sales.view' },
      {
        label: 'Customer report',
        to: paths.analytics.customers,
        permission: 'analytics.customers.view',
      },
      {
        label: 'Promotions report',
        to: paths.analytics.promotions,
        permission: 'analytics.promotions.view',
      },
      { label: 'Call history', to: paths.analytics.calls, permission: 'analytics.calls.view' },
    ],
  },
  {
    id: 'uploads',
    label: 'My uploads',
    icon: UploadCloud,
    to: paths.uploads,
    permission: 'uploads.view',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'General', to: paths.settings.general, permission: 'settings.general.view' },
      { label: 'Brands', to: paths.settings.brands, permission: 'settings.brands.view' },
      { label: 'Equipment', to: paths.settings.equipment, permission: 'settings.equipment.view' },
      { label: 'Locations', to: paths.settings.locations, permission: 'settings.locations.view' },
      { label: 'Sales', to: paths.settings.sales, permission: 'settings.sales.view' },
      { label: 'Products', to: paths.settings.products, permission: 'settings.products.view' },
      { label: 'Clients', to: paths.settings.clients, permission: 'settings.clients.view' },
      { label: 'Billing', to: paths.settings.billing, permission: 'settings.billing.view' },
      { label: 'Personal data', to: paths.settings.personal },
    ],
  },
]
