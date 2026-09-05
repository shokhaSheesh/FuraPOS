/**
 * Permission model.
 *
 * Keys are `module.section.action`. The tree mirrors the sidebar, which in
 * turn mirrors OX System (docs/OX-NAVIGATION-MAP.md). The same tree drives:
 *   1. the roles & permissions editor (a checkbox tree with partial state),
 *   2. route guards (`<RequirePermission>`),
 *   3. nav-item visibility (a section the user cannot view is not rendered).
 */

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export type PermissionKey = string

export interface PermissionNode {
  key: string
  label: string
  /** Actions available at this leaf. Absent on grouping nodes. */
  actions?: readonly PermissionAction[]
  children?: readonly PermissionNode[]
}

const crud = ['view', 'create', 'edit', 'delete'] as const
const crudExport = ['view', 'create', 'edit', 'delete', 'export'] as const
const readOnly = ['view'] as const
const readExport = ['view', 'export'] as const

export const permissionTree: readonly PermissionNode[] = [
  { key: 'dashboard', label: 'Dashboard', actions: readOnly },
  {
    key: 'sales',
    label: 'Sales',
    children: [
      { key: 'sales.orders', label: 'Sales', actions: crudExport },
      { key: 'sales.drafts', label: 'Open sales', actions: ['view', 'edit', 'delete'] },
      { key: 'sales.deleted', label: 'Deleted sales', actions: readOnly },
      { key: 'sales.postponed', label: 'Postponed sales', actions: ['view', 'edit', 'delete'] },
    ],
  },
  {
    key: 'products',
    label: 'Products / Services',
    children: [
      { key: 'products.list', label: 'Product list', actions: crudExport },
      { key: 'products.transfers', label: 'Transfers', actions: crud },
      { key: 'products.corrections', label: 'Corrections', actions: crud },
      { key: 'products.stocktaking', label: 'Stocktaking', actions: crud },
      { key: 'products.goodsReceipt', label: 'Goods receipt', actions: crud },
      { key: 'products.repricing', label: 'Repricing', actions: crud },
      { key: 'products.printTemplates', label: 'Print templates', actions: crud },
      { key: 'products.suppliers', label: 'Suppliers', actions: crud },
      { key: 'products.cost', label: 'See cost price & margin', actions: readOnly },
    ],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    children: [
      { key: 'procurement.selection', label: 'Product selection', actions: readOnly },
      { key: 'procurement.orders', label: 'Orders', actions: crudExport },
      { key: 'procurement.schedules', label: 'Selection schedule', actions: crud },
    ],
  },
  {
    key: 'personnel',
    label: 'Personnel management',
    children: [
      { key: 'personnel.employees', label: 'Employees', actions: crud },
      { key: 'personnel.motivation', label: 'Seller motivation', actions: crud },
      { key: 'personnel.planning', label: 'Planning', actions: crud },
      { key: 'personnel.roles', label: 'Access & roles', actions: crud },
      { key: 'personnel.salary', label: 'See salary & settlements', actions: readOnly },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    children: [
      { key: 'finance.dashboard', label: 'Finance dashboard', actions: readOnly },
      { key: 'finance.transactions', label: 'Transactions', actions: crudExport },
      { key: 'finance.contracts', label: 'Contracts', actions: crud },
      { key: 'finance.invoices', label: 'Invoices', actions: crudExport },
      { key: 'finance.budget', label: 'Budget', actions: crud },
      { key: 'finance.scenarios', label: 'Scenarios', actions: crud },
      { key: 'finance.pnl', label: 'P&L', actions: readExport },
      { key: 'finance.cashflow', label: 'Cashflow', actions: readExport },
      { key: 'finance.receivables', label: 'Receivables', actions: readExport },
      { key: 'finance.payables', label: 'Payables', actions: readExport },
      { key: 'finance.forecast', label: 'Cash forecast', actions: readOnly },
      { key: 'finance.settlements', label: 'Employee settlements', actions: crud },
      { key: 'finance.accounts', label: 'Accounts', actions: crud },
      { key: 'finance.categories', label: 'Categories', actions: crud },
      { key: 'finance.periodLock', label: 'Period lock', actions: ['view', 'edit'] },
      { key: 'finance.taxes', label: 'Taxes', actions: crud },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    children: [
      { key: 'marketing.clients', label: 'Clients', actions: crudExport },
      { key: 'marketing.groups', label: 'Groups', actions: crud },
      { key: 'marketing.cashback', label: 'Cashback', actions: crud },
      { key: 'marketing.sms', label: 'SMS campaigns', actions: crud },
      { key: 'marketing.digital', label: 'Digital campaigns', actions: crud },
      { key: 'marketing.promotions', label: 'Promotions', actions: crud },
      { key: 'marketing.coupons', label: 'Coupons', actions: crud },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    children: [
      { key: 'analytics.reportBuilder', label: 'Report generator', actions: crudExport },
      { key: 'analytics.productLogs', label: 'Product logs', actions: readExport },
      { key: 'analytics.storefront', label: 'Online storefront report', actions: readExport },
      { key: 'analytics.sales', label: 'Sales report', actions: readExport },
      { key: 'analytics.customers', label: 'Customer report', actions: readExport },
      { key: 'analytics.promotions', label: 'Promotions report', actions: readExport },
      { key: 'analytics.calls', label: 'Call history', actions: readExport },
    ],
  },
  { key: 'uploads', label: 'My uploads', actions: ['view', 'create'] },
  {
    key: 'settings',
    label: 'Settings',
    children: [
      { key: 'settings.general', label: 'General', actions: ['view', 'edit'] },
      { key: 'settings.brands', label: 'Brands', actions: crud },
      { key: 'settings.equipment', label: 'Equipment', actions: crud },
      { key: 'settings.locations', label: 'Locations', actions: crud },
      { key: 'settings.sales', label: 'Sales configuration', actions: crud },
      { key: 'settings.products', label: 'Product configuration', actions: crud },
      { key: 'settings.clients', label: 'Client configuration', actions: crud },
      { key: 'settings.billing', label: 'Billing', actions: ['view', 'edit'] },
    ],
  },
]

/** Flattens the tree to every grantable `module.section.action` key. */
export function flattenPermissionKeys(nodes: readonly PermissionNode[] = permissionTree): string[] {
  const keys: string[] = []
  const walk = (node: PermissionNode) => {
    if (node.actions) keys.push(...node.actions.map((action) => `${node.key}.${action}`))
    node.children?.forEach(walk)
  }
  nodes.forEach(walk)
  return keys
}

export const ALL_PERMISSIONS = flattenPermissionKeys()
