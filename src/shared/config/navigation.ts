import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Blocks,
  Boxes,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
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
    items: [
      { label: 'POS terminal', to: paths.sales.cashDesk, permission: 'sales.cashDesk.view' },
      { label: 'All sales', to: paths.sales.orders, permission: 'sales.orders.view' },
      { label: 'Cash shifts', to: paths.sales.shifts, permission: 'sales.shifts.view' },
      { label: 'Closed sales', to: paths.sales.closed, permission: 'sales.closed.view' },
      { label: 'Open sales', to: paths.sales.drafts, permission: 'sales.drafts.view' },
      { label: 'Deleted sales', to: paths.sales.deleted, permission: 'sales.deleted.view' },
      { label: 'Postponed sales', to: paths.sales.postponed, permission: 'sales.postponed.view' },
    ],
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
      {
        label: 'Product selection',
        to: paths.procurement.selection,
        permission: 'procurement.selection.view',
      },
      { label: 'Orders', to: paths.procurement.orders, permission: 'procurement.orders.view' },
      {
        label: 'Selection schedule',
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
      {
        label: 'Seller motivation',
        to: paths.personnel.motivation,
        permission: 'personnel.motivation.view',
      },
      { label: 'Planning', to: paths.personnel.planning, permission: 'personnel.planning.view' },
      { label: 'Access & roles', to: paths.personnel.roles, permission: 'personnel.roles.view' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Wallet,
    badge: 'beta',
    items: [
      { label: 'Dashboard', to: paths.finance.dashboard, permission: 'finance.dashboard.view' },
      {
        label: 'Transactions',
        to: paths.finance.transactions,
        permission: 'finance.transactions.view',
      },
      { label: 'Contracts', to: paths.finance.contracts, permission: 'finance.contracts.view' },
      { label: 'Invoices', to: paths.finance.invoices, permission: 'finance.invoices.view' },
      { label: 'Budget', to: paths.finance.budget, permission: 'finance.budget.view' },
      { label: 'Scenarios', to: paths.finance.scenarios, permission: 'finance.scenarios.view' },
      { label: 'P&L', to: paths.finance.pnl, permission: 'finance.pnl.view', group: 'Reports' },
      { label: 'Cashflow', to: paths.finance.cashflow, permission: 'finance.cashflow.view' },
      {
        label: 'Receivables',
        to: paths.finance.receivables,
        permission: 'finance.receivables.view',
      },
      { label: 'Payables', to: paths.finance.payables, permission: 'finance.payables.view' },
      { label: 'Cash forecast', to: paths.finance.forecast, permission: 'finance.forecast.view' },
      {
        label: 'Employee settlements',
        to: paths.finance.settlements,
        permission: 'finance.settlements.view',
      },
      {
        label: 'Accounts',
        to: paths.finance.accounts,
        permission: 'finance.accounts.view',
        group: 'Setup',
      },
      { label: 'Categories', to: paths.finance.categories, permission: 'finance.categories.view' },
      {
        label: 'Period lock',
        to: paths.finance.periodLock,
        permission: 'finance.periodLock.view',
      },
      { label: 'Taxes', to: paths.finance.taxes, permission: 'finance.taxes.view' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { label: 'Clients', to: paths.marketing.clients, permission: 'marketing.clients.view' },
      { label: 'Groups', to: paths.marketing.groups, permission: 'marketing.groups.view' },
      { label: 'Cashback', to: paths.marketing.cashback, permission: 'marketing.cashback.view' },
      { label: 'SMS campaigns', to: paths.marketing.sms, permission: 'marketing.sms.view' },
      {
        label: 'Digital campaigns',
        to: paths.marketing.digital,
        permission: 'marketing.digital.view',
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
        label: 'Report generator',
        to: paths.analytics.reportBuilder,
        permission: 'analytics.reportBuilder.view',
      },
      {
        label: 'Product logs',
        to: paths.analytics.productLogs,
        permission: 'analytics.productLogs.view',
      },
      {
        label: 'Online storefront report',
        to: paths.analytics.storefront,
        permission: 'analytics.storefront.view',
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
    id: 'partner',
    label: 'Partner program',
    icon: Handshake,
    to: paths.partnerProgram,
    permission: 'partnerProgram.view',
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
      { label: 'Webhooks', to: paths.settings.webhooks, permission: 'settings.webhooks.view' },
      {
        label: 'AI / MCP',
        to: paths.settings.aiConnector,
        permission: 'settings.aiConnector.view',
      },
    ],
  },
  { id: 'support', label: 'Support', icon: LifeBuoy, to: paths.support },
]
