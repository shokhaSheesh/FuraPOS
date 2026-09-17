import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/shared/layouts/AppShell'
import { AuthLayout } from '@/shared/layouts/AuthLayout'
import { PlaceholderPage } from '@/shared/components/PlaceholderPage'
import { Skeleton } from '@/shared/ui/Skeleton'
import { paths } from '@/shared/config/paths'
import { HomeRoute, RequireAuth, RequirePermission } from './guards'
import { RouteError } from './RouteError'

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const DriversPage = lazy(() => import('@/features/drivers/pages/DriversPage'))
const DriverDetailPage = lazy(() => import('@/features/drivers/pages/DriverDetailPage'))
const CashShiftsPage = lazy(() => import('@/features/cashShifts/pages/CashShiftsPage'))
const CashShiftDetailPage = lazy(() => import('@/features/cashShifts/pages/CashShiftDetailPage'))
const RegistersSettingsPage = lazy(
  () => import('@/features/cashShifts/pages/RegistersSettingsPage'),
)
const ProductsPage = lazy(() => import('@/features/products/pages/ProductsPage'))
const PrintTemplatesPage = lazy(() => import('@/features/printTemplates/pages/PrintTemplatesPage'))
const TemplateFormPage = lazy(() => import('@/features/printTemplates/pages/TemplateFormPage'))
const ProductDetailPage = lazy(() => import('@/features/products/pages/ProductDetailPage'))
const ProductFormPage = lazy(() => import('@/features/products/pages/ProductFormPage'))
const TransfersListPage = lazy(() => import('@/features/transfers/pages/TransfersListPage'))
const TransferDetailPage = lazy(() => import('@/features/transfers/pages/TransferDetailPage'))
const NewTransferPage = lazy(() => import('@/features/transfers/pages/NewTransferPage'))
const CorrectionsListPage = lazy(() => import('@/features/corrections/pages/CorrectionsListPage'))
const CorrectionDetailPage = lazy(() => import('@/features/corrections/pages/CorrectionDetailPage'))
const NewCorrectionPage = lazy(() => import('@/features/corrections/pages/NewCorrectionPage'))
const GoodsReceiptListPage = lazy(() => import('@/features/receipts/pages/GoodsReceiptListPage'))
const GoodsReceiptPage = lazy(() => import('@/features/receipts/pages/GoodsReceiptPage'))
const ReceiptImportPage = lazy(() => import('@/features/receipts/pages/ReceiptImportPage'))
const StocktakingListPage = lazy(() => import('@/features/stocktaking/pages/StocktakingListPage'))
const StocktakeDetailPage = lazy(() => import('@/features/stocktaking/pages/StocktakeDetailPage'))
const NewStocktakePage = lazy(() => import('@/features/stocktaking/pages/NewStocktakePage'))
const RepricingListPage = lazy(() => import('@/features/repricing/pages/RepricingListPage'))
const RepricingDetailPage = lazy(() => import('@/features/repricing/pages/RepricingDetailPage'))
const NewRepricingPage = lazy(() => import('@/features/repricing/pages/NewRepricingPage'))
const SuppliersListPage = lazy(() => import('@/features/suppliers/pages/SuppliersListPage'))
const SupplierDetailPage = lazy(() => import('@/features/suppliers/pages/SupplierDetailPage'))
const SupplierFormPage = lazy(() => import('@/features/suppliers/pages/SupplierFormPage'))
const ProductLogsPage = lazy(() => import('@/features/productLogs/pages/ProductLogsPage'))
const GeneralSettingsPage = lazy(() => import('@/features/settings/pages/GeneralSettingsPage'))
const BrandsSettingsPage = lazy(() => import('@/features/settings/pages/BrandsSettingsPage'))
const LocationsSettingsPage = lazy(() => import('@/features/settings/pages/LocationsSettingsPage'))
const MassUpdatePage = lazy(() => import('@/features/massUpdate/pages/MassUpdatePage'))
const CategoriesSettingsPage = lazy(
  () => import('@/features/settings/pages/CategoriesSettingsPage'),
)
const OrderDocumentPage = lazy(() => import('@/features/orders/pages/OrderDocumentPage'))
const PartnerOrdersListPage = lazy(
  () => import('@/features/partnerOrders/pages/PartnerOrdersListPage'),
)
const PartnerOrderPage = lazy(() => import('@/features/partnerOrders/pages/PartnerOrderPage'))
const OnlineSalesListPage = lazy(() => import('@/features/onlineSales/pages/OnlineSalesListPage'))
const OnlineSaleDetailPage = lazy(() => import('@/features/onlineSales/pages/OnlineSaleDetailPage'))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const MobileAppPage = lazy(() => import('@/features/mobileApp/pages/MobileAppPage'))
const PersonalSettingsPage = lazy(() => import('@/features/settings/pages/PersonalSettingsPage'))
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'))
const ReportBuilderPage = lazy(() => import('@/features/reports/pages/ReportBuilderPage'))
const ReportViewPage = lazy(() => import('@/features/reports/pages/ReportViewPage'))
const PromotionsPage = lazy(() => import('@/features/promotions/pages/PromotionsPage'))
const PromotionFormPage = lazy(() => import('@/features/promotions/pages/PromotionFormPage'))
const ClientsPage = lazy(() => import('@/features/clients/pages/ClientsPage'))
const ClientDetailPage = lazy(() => import('@/features/clients/pages/ClientDetailPage'))
const ClientFormPage = lazy(() => import('@/features/clients/pages/ClientFormPage'))
const RolesPage = lazy(() => import('@/features/roles/pages/RolesPage'))
const RoleDetailPage = lazy(() => import('@/features/roles/pages/RoleDetailPage'))
const EmployeesPage = lazy(() => import('@/features/employees/pages/EmployeesPage'))
const EmployeeDetailPage = lazy(() => import('@/features/employees/pages/EmployeeDetailPage'))
const EmployeeFormPage = lazy(() => import('@/features/employees/pages/EmployeeFormPage'))
const OrdersListPage = lazy(() => import('@/features/orders/pages/OrdersListPage'))
const OrderPage = lazy(() => import('@/features/orders/pages/OrderPage'))
const OrderImportPage = lazy(() => import('@/features/orders/pages/OrderImportPage'))
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
  /* The printable order sits outside the shell: a sheet of A4 with no sidebar
     or top bar, so what is on screen is exactly what saves to PDF. */
  {
    path: paths.procurement.orderDocument(),
    errorElement: <RouteError />,
    element: <RequireAuth>{page(<OrderDocumentPage />, 'procurement.orders.view')}</RequireAuth>,
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [{ path: paths.auth.login, element: page(<LoginPage />) }],
  },
  {
    path: '/',
    // Everything in the app sits behind sign-in.
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <HomeRoute>{page(<DashboardPage />, 'dashboard.view')}</HomeRoute>,
      },

      // --- Sales ---------------------------------------------------------
      { path: paths.sales.root, element: <Navigate to={paths.sales.orders} replace /> },
      { path: paths.sales.newSale, element: page(<NewSalePage />, 'sales.orders.create') },
      { path: paths.sales.orders, element: page(<AllSalesPage />, 'sales.orders.view') },
      { path: paths.sales.orderDetail(), element: page(<SaleDetailPage />, 'sales.orders.view') },
      {
        path: paths.sales.partnerOrders,
        element: page(<PartnerOrdersListPage />, 'sales.partnerOrders.view'),
      },
      {
        path: paths.sales.partnerOrderDetail(),
        element: page(<PartnerOrderPage />, 'sales.partnerOrders.view'),
      },
      {
        path: paths.sales.online,
        element: page(<OnlineSalesListPage />, 'sales.online.view'),
      },
      {
        path: paths.sales.onlineDetail(),
        element: page(<OnlineSaleDetailPage />, 'sales.online.view'),
      },

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
        path: paths.products.editTransfer(),
        element: page(<NewTransferPage />, 'products.transfers.create'),
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
        path: paths.products.goodsReceiptDetail(),
        element: page(<GoodsReceiptPage />, 'products.goodsReceipt.view'),
      },
      {
        path: paths.products.goodsReceiptImport(),
        element: page(<ReceiptImportPage />, 'products.goodsReceipt.create'),
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
        path: paths.users.drivers,
        element: page(<DriversPage />, 'users.drivers.view'),
      },
      {
        path: paths.users.driverDetail(),
        element: page(<DriverDetailPage />, 'users.drivers.view'),
      },
      {
        path: paths.sales.shifts,
        element: page(<CashShiftsPage />, 'sales.cashShifts.view'),
      },
      {
        path: paths.sales.shiftDetail(),
        element: page(<CashShiftDetailPage />, 'sales.cashShifts.view'),
      },
      {
        path: paths.settings.registers,
        element: page(<RegistersSettingsPage />, 'settings.registers.view'),
      },
      {
        path: paths.products.printTemplates,
        element: page(<PrintTemplatesPage />, 'products.printTemplates.view'),
      },
      {
        path: paths.products.newPrintTemplate,
        element: page(<TemplateFormPage />, 'products.printTemplates.create'),
      },
      {
        path: paths.products.editPrintTemplate(),
        element: page(<TemplateFormPage />, 'products.printTemplates.edit'),
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
        path: paths.procurement.orders,
        element: page(<OrdersListPage />, 'procurement.orders.view'),
      },
      {
        path: paths.procurement.orderDetail(),
        element: page(<OrderPage />, 'procurement.orders.view'),
      },
      {
        path: paths.procurement.orderImport(),
        element: page(<OrderImportPage />, 'procurement.orders.edit'),
      },

      // --- Users (OX: Personnel management) ----------------------------------------
      { path: paths.users.root, element: <Navigate to={paths.users.employees} replace /> },
      {
        path: paths.users.employees,
        element: page(<EmployeesPage />, 'users.employees.view'),
      },
      {
        path: paths.users.newEmployee,
        element: page(<EmployeeFormPage />, 'users.employees.create'),
      },
      {
        path: paths.users.editEmployee(),
        element: page(<EmployeeFormPage />, 'users.employees.edit'),
      },
      {
        path: paths.users.employeeDetail(),
        element: page(<EmployeeDetailPage />, 'users.employees.view'),
      },
      { path: paths.users.roles, element: page(<RolesPage />, 'users.roles.view') },
      {
        path: paths.users.roleDetail(),
        element: page(<RoleDetailPage />, 'users.roles.view'),
      },

      // --- Marketing --------------------------------------------------------
      { path: paths.marketing.root, element: <Navigate to={paths.marketing.promotions} replace /> },
      { path: paths.users.autoparks, element: page(<ClientsPage />, 'users.autoparks.view') },
      {
        path: paths.users.newAutopark,
        element: page(<ClientFormPage />, 'users.autoparks.create'),
      },
      {
        path: paths.users.editAutopark(),
        element: page(<ClientFormPage />, 'users.autoparks.edit'),
      },
      {
        path: paths.users.autoparkDetail(),
        element: page(<ClientDetailPage />, 'users.autoparks.view'),
      },
      {
        path: paths.marketing.promotions,
        element: page(<PromotionsPage />, 'marketing.promotions.view'),
      },
      {
        path: paths.marketing.newPromotion,
        element: page(<PromotionFormPage />, 'marketing.promotions.create'),
      },
      {
        path: paths.marketing.editPromotion(),
        element: page(<PromotionFormPage />, 'marketing.promotions.edit'),
      },

      // --- Analytics --------------------------------------------------------
      {
        path: paths.analytics.root,
        element: <Navigate to={paths.analytics.reports} replace />,
      },
      {
        path: paths.analytics.reports,
        element: page(<ReportsPage />, 'analytics.reportBuilder.view'),
      },
      {
        path: paths.analytics.newReport,
        element: page(<ReportBuilderPage />, 'analytics.reportBuilder.create'),
      },
      {
        path: paths.analytics.editReport(),
        element: page(<ReportBuilderPage />, 'analytics.reportBuilder.edit'),
      },
      {
        path: paths.analytics.reportView(),
        element: page(<ReportViewPage />, 'analytics.reportBuilder.view'),
      },
      {
        path: paths.analytics.productLogs,
        element: page(<ProductLogsPage />, 'analytics.productLogs.view'),
      },

      // --- Standalone sections ------------------------------------------------
      { path: paths.mobileApp, element: page(<MobileAppPage />) },
      { path: paths.activityLog, element: todo('Activity log') },

      // --- Settings -------------------------------------------------------------
      { path: paths.settings.root, element: <Navigate to={paths.settings.general} replace /> },
      {
        path: paths.settings.general,
        element: page(<GeneralSettingsPage />, 'settings.general.view'),
      },
      {
        path: paths.settings.brands,
        element: page(<BrandsSettingsPage />, 'settings.brands.view'),
      },
      {
        path: paths.settings.locations,
        element: page(<LocationsSettingsPage />, 'settings.locations.view'),
      },
      {
        path: paths.settings.categories,
        element: page(<CategoriesSettingsPage />, 'settings.products.view'),
      },
      {
        path: paths.settings.massUpdate,
        element: page(<MassUpdatePage />, 'products.list.edit'),
      },
      { path: paths.settings.personal, element: page(<PersonalSettingsPage />) },

      { path: '*', element: todo('Page not found') },
    ],
  },
]

export const router = createBrowserRouter(routes)
