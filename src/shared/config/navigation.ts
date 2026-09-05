import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Blocks,
  Boxes,
  Gift,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShoppingCart,
  Truck,
  UploadCloud,
  Users,
  Wallet,
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
}

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  /** Present on single-page sections (Dashboard, Uploads, Referral). */
  to?: string
  permission?: string
  badge?: NavBadge
  items?: NavItem[]
}

/**
 * The sidebar, top to bottom. Order here is the order on screen — see the
 * information architecture section of CLAUDE.md. Adding a screen means adding
 * it here and to the router, nowhere else.
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
    items: [
      { label: 'All sales', to: paths.sales.all, permission: 'sales.ledger.view', end: true },
      { label: 'Held sales', to: paths.sales.held, permission: 'sales.held.view' },
    ],
  },
  {
    id: 'catalog',
    label: 'Products',
    icon: Boxes,
    items: [
      { label: 'Catalog', to: paths.catalog.products, permission: 'catalog.products.view' },
      { label: 'Categories', to: paths.catalog.categories, permission: 'catalog.categories.view' },
      { label: 'Stock levels', to: paths.catalog.stock, permission: 'catalog.stock.view' },
      { label: 'Goods receipt', to: paths.catalog.receipts, permission: 'catalog.receipts.view' },
      {
        label: 'Stock adjustment',
        to: paths.catalog.adjustments,
        permission: 'catalog.adjustments.view',
      },
      { label: 'Transfers', to: paths.catalog.transfers, permission: 'catalog.transfers.view' },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: Truck,
    items: [
      {
        label: 'Purchase orders',
        to: paths.procurement.orders,
        permission: 'procurement.orders.view',
      },
      {
        label: 'Suppliers',
        to: paths.procurement.suppliers,
        permission: 'procurement.suppliers.view',
      },
      {
        label: 'Reorder suggestions',
        to: paths.procurement.reorder,
        permission: 'procurement.reorder.view',
        badge: 'beta',
      },
    ],
  },
  {
    id: 'hr',
    label: 'Staff',
    icon: Users,
    items: [
      { label: 'Employees', to: paths.hr.employees, permission: 'hr.employees.view' },
      { label: 'Roles & permissions', to: paths.hr.roles, permission: 'hr.roles.view' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    items: [
      { label: 'P&L', to: paths.finance.pnl, permission: 'finance.pnl.view' },
      { label: 'Cashflow', to: paths.finance.cashflow, permission: 'finance.cashflow.view' },
      {
        label: 'Receivables',
        to: paths.finance.receivables,
        permission: 'finance.receivables.view',
      },
      { label: 'Payables', to: paths.finance.payables, permission: 'finance.payables.view' },
      { label: 'Cash forecast', to: paths.finance.forecast, permission: 'finance.forecast.view' },
      { label: 'Budgeting', to: paths.finance.budgets, permission: 'finance.budgets.view' },
      {
        label: 'Settlements',
        to: paths.finance.settlements,
        permission: 'finance.settlements.view',
      },
      { label: 'Scenarios', to: paths.finance.scenarios, permission: 'finance.scenarios.view' },
      { label: 'Categories', to: paths.finance.categories, permission: 'finance.categories.view' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { label: 'Clients', to: paths.marketing.clients, permission: 'marketing.clients.view' },
      { label: 'Segments', to: paths.marketing.segments, permission: 'marketing.segments.view' },
      { label: 'Cashback', to: paths.marketing.cashback, permission: 'marketing.cashback.view' },
      { label: 'SMS campaigns', to: paths.marketing.sms, permission: 'marketing.sms.view' },
      {
        label: 'Digital campaigns',
        to: paths.marketing.campaigns,
        permission: 'marketing.campaigns.view',
      },
      {
        label: 'Promotions',
        to: paths.marketing.promotions,
        permission: 'marketing.promotions.view',
      },
      { label: 'Coupons', to: paths.marketing.coupons, permission: 'marketing.coupons.view' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    items: [
      {
        label: 'Report builder',
        to: paths.analytics.reports,
        permission: 'analytics.reports.view',
      },
      { label: 'Sales report', to: paths.analytics.sales, permission: 'analytics.sales.view' },
      {
        label: 'Customer analytics',
        to: paths.analytics.customers,
        permission: 'analytics.customers.view',
      },
      {
        label: 'Inventory change log',
        to: paths.analytics.inventoryLog,
        permission: 'analytics.inventoryLog.view',
      },
      {
        label: 'Promotions performance',
        to: paths.analytics.promotions,
        permission: 'analytics.promotions.view',
      },
      {
        label: 'Online storefront',
        to: paths.analytics.storefront,
        permission: 'analytics.storefront.view',
      },
      { label: 'Call log', to: paths.analytics.calls, permission: 'analytics.calls.view' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Blocks,
    to: paths.integrations.root,
    permission: 'integrations.view',
  },
  {
    id: 'uploads',
    label: 'My uploads',
    icon: UploadCloud,
    to: paths.uploads,
    permission: 'uploads.view',
  },
  {
    id: 'referral',
    label: 'Referral program',
    icon: Gift,
    to: paths.referral,
    permission: 'referral.view',
    badge: 'new',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'Company', to: paths.settings.company, permission: 'settings.company.view' },
      { label: 'Locations', to: paths.settings.locations, permission: 'settings.locations.view' },
      { label: 'Brands', to: paths.settings.brands, permission: 'settings.brands.view' },
      { label: 'Equipment', to: paths.settings.equipment, permission: 'settings.equipment.view' },
      { label: 'Sales config', to: paths.settings.terminals, permission: 'settings.sales.view' },
      {
        label: 'Product config',
        to: paths.settings.productCategories,
        permission: 'settings.products.view',
      },
      {
        label: 'Client fields',
        to: paths.settings.clientFields,
        permission: 'settings.clientFields.view',
      },
      { label: 'Billing', to: paths.settings.billing, permission: 'settings.billing.view' },
      { label: 'Webhooks', to: paths.settings.webhooks, permission: 'settings.webhooks.view' },
      {
        label: 'AI connector',
        to: paths.settings.aiConnector,
        permission: 'settings.aiConnector.view',
        badge: 'new',
      },
      { label: 'Profile', to: paths.settings.profile },
      { label: 'Notifications', to: paths.settings.notifications },
    ],
  },
]
