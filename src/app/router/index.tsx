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
const ProductDetailPage = lazy(() => import('@/features/products/pages/ProductDetailPage'))
const ProductFormPage = lazy(() => import('@/features/products/pages/ProductFormPage'))
const TransfersListPage = lazy(() => import('@/features/transfers/pages/TransfersListPage'))
const TransferDetailPage = lazy(() => import('@/features/transfers/pages/TransferDetailPage'))
const NewTransferPage = lazy(() => import('@/features/transfers/pages/NewTransferPage'))
const CorrectionsListPage = lazy(() => import('@/features/corrections/pages/CorrectionsListPage'))
const CorrectionDetailPage = lazy(() => import('@/features/corrections/pages/CorrectionDetailPage'))
const NewCorrectionPage = lazy(() => import('@/features/corrections/pages/NewCorrectionPage'))
const GoodsReceiptListPage = lazy(() => import('@/features/receipts/pages/GoodsReceiptListPage'))
const GoodsReceiptDetailPage = lazy(
  () => import('@/features/receipts/pages/GoodsReceiptDetailPage'),
)
const NewGoodsReceiptPage = lazy(() => import('@/features/receipts/pages/NewGoodsReceiptPage'))
const StocktakingListPage = lazy(() => import('@/features/stocktaking/pages/StocktakingListPage'))
const StocktakeDetailPage = lazy(() => import('@/features/stocktaking/pages/StocktakeDetailPage'))
const NewStocktakePage = lazy(() => import('@/features/stocktaking/pages/NewStocktakePage'))
const RepricingListPage = lazy(() => import('@/features/repricing/pages/RepricingListPage'))
const RepricingDetailPage = lazy(() => import('@/features/repricing/pages/RepricingDetailPage'))
const NewRepricingPage = lazy(() => import('@/features/repricing/pages/NewRepricingPage'))
const SuppliersListPage = lazy(() => import('@/features/suppliers/pages/SuppliersListPage'))
const SupplierDetailPage = lazy(() => import('@/features/suppliers/pages/SupplierDetailPage'))
const SupplierFormPage = lazy(() => import('@/features/suppliers/pages/SupplierFormPage'))
const OrdersListPage = lazy(() => import('@/features/orders/pages/OrdersListPage'))
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'))
const NewOrderPage = lazy(() => import('@/features/orders/pages/NewOrderPage'))
const NewSalePage = lazy(() => import('@/features/sales/pages/NewSalePage'))
const AllSalesPage = lazy(() => import('@/features/sales/pages/SalesListPage'))
const SaleDetailPage = lazy(() => import('@/features/sales/pages/SaleDetailPage'))

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
      { path: paths.sales.orderDetail(), element: page(<SaleDetailPage />, 'sales.orders.view') },

      // --- Products / Services -------------------------------------------
      { path: paths.products.root, element: <Navigate to={paths.products.list} replace /> },
      { path: paths.products.list, element: page(<ProductsPage />, 'products.list.view') },
      { path: paths.products.new, element: page(<ProductFormPage />, 'products.list.create') },
      { path: paths.products.detail(), element: page(<ProductDetailPage />, 'products.list.view') },
      { path: paths.products.edit(), element: page(<ProductFormPage />, 'products.list.edit') },
      {
        path: paths.products.transfers,
        element: page(<TransfersListPage />, 'products.transfers.view'),
      },
      {
        path: paths.products.newTransfer,
        element: page(<NewTransferPage />, 'products.transfers.create'),
      },
      {
        path: paths.products.transferDetail(),
        element: page(<TransferDetailPage />, 'products.transfers.view'),
      },
      {
        path: paths.products.corrections,
        element: page(<CorrectionsListPage />, 'products.corrections.view'),
      },
      {
        path: paths.products.newCorrection,
        element: page(<NewCorrectionPage />, 'products.corrections.create'),
      },
      {
        path: paths.products.correctionDetail(),
        element: page(<CorrectionDetailPage />, 'products.corrections.view'),
      },
      {
        path: paths.products.stocktaking,
        element: page(<StocktakingListPage />, 'products.stocktaking.view'),
      },
      {
        path: paths.products.newStocktake,
        element: page(<NewStocktakePage />, 'products.stocktaking.create'),
      },
      {
        path: paths.products.stocktakeDetail(),
        element: page(<StocktakeDetailPage />, 'products.stocktaking.view'),
      },
      {
        path: paths.products.goodsReceipt,
        element: page(<GoodsReceiptListPage />, 'products.goodsReceipt.view'),
      },
      {
        path: paths.products.newGoodsReceipt,
        element: page(<NewGoodsReceiptPage />, 'products.goodsReceipt.create'),
      },
      {
        path: paths.products.goodsReceiptDetail(),
        element: page(<GoodsReceiptDetailPage />, 'products.goodsReceipt.view'),
      },
      {
        path: paths.products.repricing,
        element: page(<RepricingListPage />, 'products.repricing.view'),
      },
      {
        path: paths.products.newRepricing,
        element: page(<NewRepricingPage />, 'products.repricing.create'),
      },
      {
        path: paths.products.repricingDetail(),
        element: page(<RepricingDetailPage />, 'products.repricing.view'),
      },
      {
        path: paths.products.printTemplates,
        element: todo('Print templates', 'products.printTemplates.view'),
      },
      {
        path: paths.products.suppliers,
        element: page(<SuppliersListPage />, 'products.suppliers.view'),
      },
      {
        path: paths.products.newSupplier,
        element: page(<SupplierFormPage />, 'products.suppliers.create'),
      },
      {
        path: paths.products.supplierDetail(),
        element: page(<SupplierDetailPage />, 'products.suppliers.view'),
      },
      {
        path: paths.products.editSupplier(),
        element: page(<SupplierFormPage />, 'products.suppliers.edit'),
      },

      // --- Procurement ----------------------------------------------------
      { path: paths.procurement.root, element: <Navigate to={paths.procurement.orders} replace /> },
      {
        path: paths.procurement.selection,
        element: todo('Product selection', 'procurement.selection.view'),
      },
      {
        path: paths.procurement.orders,
        element: page(<OrdersListPage />, 'procurement.orders.view'),
      },
      {
        path: paths.procurement.newOrder,
        element: page(<NewOrderPage />, 'procurement.orders.create'),
      },
      {
        path: paths.procurement.orderDetail(),
        element: page(<OrderDetailPage />, 'procurement.orders.view'),
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
