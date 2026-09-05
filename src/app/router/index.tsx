import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/shared/layouts/AppShell'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'
import { Skeleton } from '@/shared/ui/Skeleton'
import { paths } from '@/shared/config/paths'
import { RequirePermission } from './guards'
import { RouteError } from './RouteError'

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const ProductsPage = lazy(() => import('@/features/products/pages/ProductsPage'))
const NewSalePage = lazy(() => import('@/features/sales/pages/NewSalePage'))
const AllSalesPage = lazy(() => import('@/features/sales/pages/SalesListPage'))
const OpenSalesPage = lazy(() =>
  import('@/features/sales/pages/SalesStatusPages').then((m) => ({ default: m.OpenSalesPage })),
)
const ClosedSalesPage = lazy(() =>
  import('@/features/sales/pages/SalesStatusPages').then((m) => ({ default: m.ClosedSalesPage })),
)
const PostponedSalesPage = lazy(() =>
  import('@/features/sales/pages/SalesStatusPages').then((m) => ({
    default: m.PostponedSalesPage,
  })),
)
const DeletedSalesPage = lazy(() =>
  import('@/features/sales/pages/SalesStatusPages').then((m) => ({ default: m.DeletedSalesPage })),
)

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
 * sidebar is fully navigable and nobody has to guess what is coming.
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

      // --- Sales ---------------------------------------------------------
      { path: paths.sales.root, element: <Navigate to={paths.sales.orders} replace /> },
      { path: paths.sales.newSale, element: page(<NewSalePage />, 'sales.orders.create') },
      { path: paths.sales.orders, element: page(<AllSalesPage />, 'sales.orders.view') },
      { path: paths.sales.orderDetail(), element: todo('Sale', 'sales.orders.view') },
      { path: paths.sales.shifts, element: todo('Cash shifts', 'sales.shifts.view') },
      { path: paths.sales.closed, element: page(<ClosedSalesPage />, 'sales.closed.view') },
      { path: paths.sales.drafts, element: page(<OpenSalesPage />, 'sales.drafts.view') },
      { path: paths.sales.deleted, element: page(<DeletedSalesPage />, 'sales.deleted.view') },
      {
        path: paths.sales.postponed,
        element: page(<PostponedSalesPage />, 'sales.postponed.view'),
      },

      // --- Products / Services -------------------------------------------
      { path: paths.products.root, element: <Navigate to={paths.products.list} replace /> },
      { path: paths.products.list, element: page(<ProductsPage />, 'products.list.view') },
      { path: paths.products.detail(), element: todo('Product', 'products.list.view') },
      { path: paths.products.transfers, element: todo('Transfers', 'products.transfers.view') },
      {
        path: paths.products.corrections,
        element: todo('Corrections', 'products.corrections.view'),
      },
      {
        path: paths.products.stocktaking,
        element: todo('Stocktaking', 'products.stocktaking.view'),
      },
      {
        path: paths.products.goodsReceipt,
        element: todo('Goods receipt', 'products.goodsReceipt.view'),
      },
      { path: paths.products.repricing, element: todo('Repricing', 'products.repricing.view') },
      {
        path: paths.products.printTemplates,
        element: todo('Print templates', 'products.printTemplates.view'),
      },
      { path: paths.products.suppliers, element: todo('Suppliers', 'products.suppliers.view') },
      {
        path: paths.products.supplierDetail(),
        element: todo('Supplier', 'products.suppliers.view'),
      },

      // --- Procurement ----------------------------------------------------
      { path: paths.procurement.root, element: <Navigate to={paths.procurement.orders} replace /> },
      {
        path: paths.procurement.selection,
        element: todo('Product selection', 'procurement.selection.view'),
      },
      { path: paths.procurement.orders, element: todo('Orders', 'procurement.orders.view') },
      {
        path: paths.procurement.orderDetail(),
        element: todo('Purchase order', 'procurement.orders.view'),
      },
      {
        path: paths.procurement.schedules,
        element: todo('Selection schedule', 'procurement.schedules.view'),
      },

      // --- Personnel management -------------------------------------------
      { path: paths.personnel.root, element: <Navigate to={paths.personnel.employees} replace /> },
      {
        path: paths.personnel.employees,
        element: todo('Employees', 'personnel.employees.view'),
      },
      {
        path: paths.personnel.employeeDetail(),
        element: todo('Employee', 'personnel.employees.view'),
      },
      {
        path: paths.personnel.motivation,
        element: todo('Seller motivation', 'personnel.motivation.view'),
      },
      { path: paths.personnel.planning, element: todo('Planning', 'personnel.planning.view') },
      { path: paths.personnel.roles, element: todo('Access & roles', 'personnel.roles.view') },
      { path: paths.personnel.roleDetail(), element: todo('Role', 'personnel.roles.view') },

      // --- Finance ---------------------------------------------------------
      { path: paths.finance.root, element: <Navigate to={paths.finance.dashboard} replace /> },
      {
        path: paths.finance.dashboard,
        element: todo('Finance dashboard', 'finance.dashboard.view'),
      },
      {
        path: paths.finance.transactions,
        element: todo('Transactions', 'finance.transactions.view'),
      },
      { path: paths.finance.contracts, element: todo('Contracts', 'finance.contracts.view') },
      { path: paths.finance.invoices, element: todo('Invoices', 'finance.invoices.view') },
      { path: paths.finance.budget, element: todo('Budget', 'finance.budget.view') },
      { path: paths.finance.scenarios, element: todo('Scenarios', 'finance.scenarios.view') },
      { path: paths.finance.pnl, element: todo('Profit & loss', 'finance.pnl.view') },
      { path: paths.finance.cashflow, element: todo('Cashflow', 'finance.cashflow.view') },
      {
        path: paths.finance.receivables,
        element: todo('Receivables', 'finance.receivables.view'),
      },
      { path: paths.finance.payables, element: todo('Payables', 'finance.payables.view') },
      { path: paths.finance.forecast, element: todo('Cash forecast', 'finance.forecast.view') },
      {
        path: paths.finance.settlements,
        element: todo('Employee settlements', 'finance.settlements.view'),
      },
      { path: paths.finance.accounts, element: todo('Accounts', 'finance.accounts.view') },
      { path: paths.finance.categories, element: todo('Categories', 'finance.categories.view') },
      { path: paths.finance.periodLock, element: todo('Period lock', 'finance.periodLock.view') },
      { path: paths.finance.taxes, element: todo('Taxes', 'finance.taxes.view') },

      // --- Marketing --------------------------------------------------------
      { path: paths.marketing.root, element: <Navigate to={paths.marketing.clients} replace /> },
      { path: paths.marketing.clients, element: todo('Clients', 'marketing.clients.view') },
      { path: paths.marketing.clientDetail(), element: todo('Client', 'marketing.clients.view') },
      { path: paths.marketing.groups, element: todo('Groups', 'marketing.groups.view') },
      { path: paths.marketing.cashback, element: todo('Cashback', 'marketing.cashback.view') },
      { path: paths.marketing.sms, element: todo('SMS campaigns', 'marketing.sms.view') },
      {
        path: paths.marketing.digital,
        element: todo('Digital campaigns', 'marketing.digital.view'),
      },
      {
        path: paths.marketing.promotions,
        element: todo('Promotions', 'marketing.promotions.view'),
      },
      { path: paths.marketing.coupons, element: todo('Coupons', 'marketing.coupons.view') },

      // --- Analytics --------------------------------------------------------
      {
        path: paths.analytics.root,
        element: <Navigate to={paths.analytics.reportBuilder} replace />,
      },
      {
        path: paths.analytics.reportBuilder,
        element: todo('Report generator', 'analytics.reportBuilder.view'),
      },
      {
        path: paths.analytics.reportDetail(),
        element: todo('Report', 'analytics.reportBuilder.view'),
      },
      {
        path: paths.analytics.productLogs,
        element: todo('Product logs', 'analytics.productLogs.view'),
      },
      {
        path: paths.analytics.storefront,
        element: todo('Online storefront report', 'analytics.storefront.view'),
      },
      { path: paths.analytics.sales, element: todo('Sales report', 'analytics.sales.view') },
      {
        path: paths.analytics.customers,
        element: todo('Customer report', 'analytics.customers.view'),
      },
      {
        path: paths.analytics.promotions,
        element: todo('Promotions report', 'analytics.promotions.view'),
      },
      { path: paths.analytics.calls, element: todo('Call history', 'analytics.calls.view') },

      // --- Standalone sections ------------------------------------------------
      { path: paths.uploads, element: todo('My uploads', 'uploads.view') },
      { path: paths.activityLog, element: todo('Activity log') },

      // --- Settings -------------------------------------------------------------
      { path: paths.settings.root, element: <Navigate to={paths.settings.general} replace /> },
      { path: paths.settings.general, element: todo('General', 'settings.general.view') },
      { path: paths.settings.brands, element: todo('Brands', 'settings.brands.view') },
      { path: paths.settings.equipment, element: todo('Equipment', 'settings.equipment.view') },
      { path: paths.settings.locations, element: todo('Locations', 'settings.locations.view') },
      { path: paths.settings.sales, element: todo('Sales configuration', 'settings.sales.view') },
      {
        path: paths.settings.products,
        element: todo('Product configuration', 'settings.products.view'),
      },
      {
        path: paths.settings.clients,
        element: todo('Client configuration', 'settings.clients.view'),
      },
      { path: paths.settings.billing, element: todo('Billing', 'settings.billing.view') },
      { path: paths.settings.personal, element: todo('Personal data') },

      { path: '*', element: todo('Page not found') },
    ],
  },
]

export const router = createBrowserRouter(routes)
