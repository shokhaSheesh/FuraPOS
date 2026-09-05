import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/shared/layouts/AppShell'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'
import { Skeleton } from '@/shared/ui/Skeleton'
import { paths } from '@/shared/config/paths'
import { RequirePermission } from './guards'
import { RouteError } from './RouteError'

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const ProductsPage = lazy(() => import('@/features/catalog/pages/ProductsPage'))

function Loading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

/** Wraps a lazy page in its suspense fallback and (optionally) a guard. */
function page(element: ReactNode, permission?: string) {
  const guarded = permission ? (
    <RequirePermission permission={permission}>{element}</RequirePermission>
  ) : (
    element
  )
  return <Suspense fallback={<Loading />}>{guarded}</Suspense>
}

/**
 * A route whose screen is not built yet. Keeping these in the tree means the
 * sidebar is fully navigable and nobody has to guess what's coming.
 */
function todo(title: string, permission?: string, description?: string): ReactNode {
  return page(<PlaceholderPage title={title} description={description} />, permission)
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: page(<DashboardPage />, 'dashboard.view') },

      // --- Sales -------------------------------------------------------
      { path: paths.sales.all, element: todo('All sales', 'sales.ledger.view') },
      { path: paths.sales.held, element: todo('Held sales', 'sales.held.view') },
      { path: paths.sales.detail(), element: todo('Sale', 'sales.ledger.view') },

      // --- Products / inventory ---------------------------------------
      { path: paths.catalog.root, element: <Navigate to={paths.catalog.products} replace /> },
      { path: paths.catalog.products, element: page(<ProductsPage />, 'catalog.products.view') },
      { path: paths.catalog.productDetail(), element: todo('Product', 'catalog.products.view') },
      { path: paths.catalog.categories, element: todo('Categories', 'catalog.categories.view') },
      { path: paths.catalog.stock, element: todo('Stock levels', 'catalog.stock.view') },
      { path: paths.catalog.receipts, element: todo('Goods receipt', 'catalog.receipts.view') },
      { path: paths.catalog.receiptDetail(), element: todo('Receipt', 'catalog.receipts.view') },
      { path: paths.catalog.adjustments, element: todo('Stock adjustment', 'catalog.adjustments.view') },
      { path: paths.catalog.transfers, element: todo('Transfers', 'catalog.transfers.view') },

      // --- Procurement -------------------------------------------------
      { path: paths.procurement.root, element: <Navigate to={paths.procurement.orders} replace /> },
      { path: paths.procurement.orders, element: todo('Purchase orders', 'procurement.orders.view') },
      { path: paths.procurement.orderDetail(), element: todo('Purchase order', 'procurement.orders.view') },
      { path: paths.procurement.suppliers, element: todo('Suppliers', 'procurement.suppliers.view') },
      { path: paths.procurement.supplierDetail(), element: todo('Supplier', 'procurement.suppliers.view') },
      {
        path: paths.procurement.reorder,
        element: todo('Reorder suggestions', 'procurement.reorder.view'),
      },

      // --- Staff --------------------------------------------------------
      { path: paths.hr.root, element: <Navigate to={paths.hr.employees} replace /> },
      { path: paths.hr.employees, element: todo('Employees', 'hr.employees.view') },
      { path: paths.hr.employeeDetail(), element: todo('Employee', 'hr.employees.view') },
      { path: paths.hr.roles, element: todo('Roles & permissions', 'hr.roles.view') },
      { path: paths.hr.roleDetail(), element: todo('Role', 'hr.roles.view') },

      // --- Finance ------------------------------------------------------
      { path: paths.finance.root, element: <Navigate to={paths.finance.pnl} replace /> },
      { path: paths.finance.pnl, element: todo('Profit & loss', 'finance.pnl.view') },
      { path: paths.finance.cashflow, element: todo('Cashflow', 'finance.cashflow.view') },
      { path: paths.finance.receivables, element: todo('Receivables', 'finance.receivables.view') },
      { path: paths.finance.payables, element: todo('Payables', 'finance.payables.view') },
      { path: paths.finance.forecast, element: todo('Cash forecast', 'finance.forecast.view') },
      { path: paths.finance.budgets, element: todo('Budgeting', 'finance.budgets.view') },
      { path: paths.finance.settlements, element: todo('Employee settlements', 'finance.settlements.view') },
      { path: paths.finance.scenarios, element: todo('Scenarios', 'finance.scenarios.view') },
      { path: paths.finance.categories, element: todo('Transaction categories', 'finance.categories.view') },

      // --- Marketing ----------------------------------------------------
      { path: paths.marketing.root, element: <Navigate to={paths.marketing.clients} replace /> },
      { path: paths.marketing.clients, element: todo('Clients', 'marketing.clients.view') },
      { path: paths.marketing.clientDetail(), element: todo('Client', 'marketing.clients.view') },
      { path: paths.marketing.segments, element: todo('Segments', 'marketing.segments.view') },
      { path: paths.marketing.cashback, element: todo('Cashback program', 'marketing.cashback.view') },
      { path: paths.marketing.sms, element: todo('SMS campaigns', 'marketing.sms.view') },
      { path: paths.marketing.campaigns, element: todo('Digital campaigns', 'marketing.campaigns.view') },
      { path: paths.marketing.promotions, element: todo('Promotions', 'marketing.promotions.view') },
      { path: paths.marketing.coupons, element: todo('Coupons', 'marketing.coupons.view') },

      // --- Analytics ----------------------------------------------------
      { path: paths.analytics.root, element: <Navigate to={paths.analytics.reports} replace /> },
      { path: paths.analytics.reports, element: todo('Report builder', 'analytics.reports.view') },
      { path: paths.analytics.reportDetail(), element: todo('Report', 'analytics.reports.view') },
      { path: paths.analytics.sales, element: todo('Sales report', 'analytics.sales.view') },
      { path: paths.analytics.customers, element: todo('Customer analytics', 'analytics.customers.view') },
      { path: paths.analytics.inventoryLog, element: todo('Inventory change log', 'analytics.inventoryLog.view') },
      { path: paths.analytics.promotions, element: todo('Promotions performance', 'analytics.promotions.view') },
      { path: paths.analytics.storefront, element: todo('Online storefront', 'analytics.storefront.view') },
      { path: paths.analytics.calls, element: todo('Call log', 'analytics.calls.view') },

      // --- Standalone sections -------------------------------------------
      { path: paths.integrations.root, element: todo('Integrations', 'integrations.view') },
      { path: paths.integrations.detail(), element: todo('Integration', 'integrations.view') },
      { path: paths.uploads, element: todo('My uploads', 'uploads.view') },
      { path: paths.referral, element: todo('Referral program', 'referral.view') },
      { path: paths.activityLog, element: todo('Activity log') },

      // --- Settings -------------------------------------------------------
      { path: paths.settings.root, element: <Navigate to={paths.settings.company} replace /> },
      { path: paths.settings.company, element: todo('Company profile', 'settings.company.view') },
      { path: paths.settings.brands, element: todo('Brands', 'settings.brands.view') },
      { path: paths.settings.equipment, element: todo('Equipment', 'settings.equipment.view') },
      { path: paths.settings.locations, element: todo('Locations', 'settings.locations.view') },
      { path: paths.settings.terminals, element: todo('Kassa terminals', 'settings.sales.view') },
      { path: paths.settings.paymentMethods, element: todo('Payment methods', 'settings.sales.view') },
      { path: paths.settings.salesFunnel, element: todo('Sales funnel', 'settings.sales.view') },
      { path: paths.settings.installments, element: todo('Installment plans', 'settings.sales.view') },
      { path: paths.settings.productCategories, element: todo('Product categories', 'settings.products.view') },
      { path: paths.settings.receiptOptions, element: todo('Receipt options', 'settings.products.view') },
      { path: paths.settings.bulkUpdate, element: todo('Bulk update', 'settings.products.view') },
      { path: paths.settings.clientFields, element: todo('Client custom fields', 'settings.clientFields.view') },
      { path: paths.settings.billing, element: todo('Billing & subscription', 'settings.billing.view') },
      { path: paths.settings.profile, element: todo('My profile') },
      { path: paths.settings.notifications, element: todo('Notification preferences') },
      { path: paths.settings.webhooks, element: todo('Webhooks', 'settings.webhooks.view') },
      {
        path: paths.settings.aiConnector,
        element: todo(
          'AI connector',
          'settings.aiConnector.view',
          'Connect Claude or another assistant read-only to your own data.',
        ),
      },

      { path: '*', element: todo('Page not found') },
    ],
  },
]

export const router = createBrowserRouter(routes)
