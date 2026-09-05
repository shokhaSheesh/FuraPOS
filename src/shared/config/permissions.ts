/**
 * Permission model.
 *
 * Keys are `module.section.action`. The same tree drives three things, which
 * is why it lives in config and not in the HR feature:
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
      { key: 'sales.ledger', label: 'Sales ledger', actions: readExport },
      { key: 'sales.held', label: 'Held sales', actions: ['view', 'edit', 'delete'] },
      { key: 'sales.terminal', label: 'Open POS terminal', actions: readOnly },
    ],
  },
  {
    key: 'catalog',
    label: 'Products & inventory',
    children: [
      { key: 'catalog.products', label: 'Products', actions: crudExport },
      { key: 'catalog.categories', label: 'Categories', actions: crud },
      { key: 'catalog.stock', label: 'Stock levels', actions: readExport },
      { key: 'catalog.receipts', label: 'Goods receipt', actions: crud },
      { key: 'catalog.adjustments', label: 'Stock adjustment', actions: crud },
      { key: 'catalog.transfers', label: 'Transfers', actions: crud },
      { key: 'catalog.cost', label: 'See cost price & margin', actions: readOnly },
    ],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    children: [
      { key: 'procurement.orders', label: 'Purchase orders', actions: crudExport },
      { key: 'procurement.suppliers', label: 'Suppliers', actions: crud },
      { key: 'procurement.reorder', label: 'Reorder suggestions', actions: readOnly },
    ],
  },
  {
    key: 'hr',
    label: 'Staff',
    children: [
      { key: 'hr.employees', label: 'Employees', actions: crud },
      { key: 'hr.roles', label: 'Roles & permissions', actions: crud },
      { key: 'hr.salary', label: 'See salary & settlements', actions: readOnly },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    children: [
      { key: 'finance.pnl', label: 'P&L', actions: readExport },
      { key: 'finance.cashflow', label: 'Cashflow', actions: readExport },
      { key: 'finance.receivables', label: 'Receivables', actions: readExport },
      { key: 'finance.payables', label: 'Payables', actions: readExport },
      { key: 'finance.forecast', label: 'Cash forecast', actions: readOnly },
      { key: 'finance.budgets', label: 'Budgeting', actions: crud },
      { key: 'finance.settlements', label: 'Employee settlements', actions: crud },
      { key: 'finance.scenarios', label: 'Scenarios', actions: crud },
      { key: 'finance.categories', label: 'Transaction categories', actions: crud },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    children: [
      { key: 'marketing.clients', label: 'Clients', actions: crudExport },
      { key: 'marketing.segments', label: 'Segments', actions: crud },
      { key: 'marketing.cashback', label: 'Cashback program', actions: crud },
      { key: 'marketing.sms', label: 'SMS campaigns', actions: crud },
      { key: 'marketing.campaigns', label: 'Digital campaigns', actions: crud },
      { key: 'marketing.promotions', label: 'Promotions', actions: crud },
      { key: 'marketing.coupons', label: 'Coupons', actions: crud },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    children: [
      { key: 'analytics.reports', label: 'Report builder', actions: crudExport },
      { key: 'analytics.inventoryLog', label: 'Inventory change log', actions: readExport },
      { key: 'analytics.storefront', label: 'Online storefront report', actions: readExport },
      { key: 'analytics.sales', label: 'Sales report', actions: readExport },
      { key: 'analytics.customers', label: 'Customer analytics', actions: readExport },
      { key: 'analytics.promotions', label: 'Promotions performance', actions: readExport },
      { key: 'analytics.calls', label: 'Call log', actions: readExport },
    ],
  },
  { key: 'integrations', label: 'Integrations', actions: ['view', 'edit'] },
  { key: 'uploads', label: 'My uploads', actions: ['view', 'create'] },
  { key: 'referral', label: 'Referral program', actions: readOnly },
  {
    key: 'settings',
    label: 'Settings',
    children: [
      { key: 'settings.company', label: 'Company profile', actions: ['view', 'edit'] },
      { key: 'settings.brands', label: 'Brands', actions: crud },
      { key: 'settings.equipment', label: 'Equipment', actions: crud },
      { key: 'settings.locations', label: 'Locations', actions: crud },
      { key: 'settings.sales', label: 'Sales configuration', actions: crud },
      { key: 'settings.products', label: 'Product configuration', actions: crud },
      { key: 'settings.clientFields', label: 'Client custom fields', actions: crud },
      { key: 'settings.billing', label: 'Billing & subscription', actions: ['view', 'edit'] },
      { key: 'settings.webhooks', label: 'Webhooks', actions: crud },
      { key: 'settings.aiConnector', label: 'AI / MCP connector', actions: ['view', 'edit'] },
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
