/**
 * Every route path in the app, in one place. Never hardcode a URL string in a
 * component — import from here so renames are a single edit and the nav tree,
 * the router and any <Link> can never drift apart.
 *
 * The structure mirrors OX System one-for-one; see docs/OX-NAVIGATION-MAP.md
 * for the label and route correspondence. The `OX:` comments give the
 * reference product's own route, for cross-checking a screen while building it.
 */
export const paths = {
  auth: {
    login: '/login',
    forgotPassword: '/forgot-password',
  },

  dashboard: '/',

  sales: {
    root: '/sales',
    /** Manual sale entry — this product has no cashier POS. */
    newSale: '/sales/new',
    orders: '/sales/orders', // OX: /app/sells/orders
    /**
     * A status view is the ledger with a filter, not a page of its own — the
     * chips on All sales write exactly this, so links and chips agree.
     */
    ordersByStatus: (status: string) => `/sales/orders?status=${status}`,
    orderDetail: (id = ':orderId') => `/sales/orders/${id}`,
  },

  products: {
    root: '/products',
    list: '/products/list', // OX: /app/products/management
    new: '/products/list/new',
    detail: (id = ':productId') => `/products/list/${id}`,
    edit: (id = ':productId') => `/products/list/${id}/edit`,
    transfers: '/products/transfers', // OX: /app/products/transfers
    newTransfer: '/products/transfers/new',
    transferDetail: (id = ':transferId') => `/products/transfers/${id}`,
    corrections: '/products/corrections', // OX: /app/products/corrections
    newCorrection: '/products/corrections/new',
    correctionDetail: (id = ':correctionId') => `/products/corrections/${id}`,
    stocktaking: '/products/stocktaking', // OX: /app/products/reviews
    newStocktake: '/products/stocktaking/new',
    stocktakeDetail: (id = ':stocktakeId') => `/products/stocktaking/${id}`,
    goodsReceipt: '/products/goods-receipt', // OX: /app/products/imports
    newGoodsReceipt: '/products/goods-receipt/new',
    goodsReceiptDetail: (id = ':receiptId') => `/products/goods-receipt/${id}`,
    repricing: '/products/repricing', // OX: /app/products/reprices
    newRepricing: '/products/repricing/new',
    repricingDetail: (id = ':repricingId') => `/products/repricing/${id}`,
    printTemplates: '/products/print-templates', // OX: /app/products/stickers
    suppliers: '/products/suppliers', // OX: /app/products/suppliers
    newSupplier: '/products/suppliers/new',
    supplierDetail: (id = ':supplierId') => `/products/suppliers/${id}`,
    editSupplier: (id = ':supplierId') => `/products/suppliers/${id}/edit`,
  },

  procurement: {
    root: '/procurement',
    orders: '/procurement/orders', // OX: /app/procurement/orders
    newOrder: '/procurement/orders/new',
    orderDetail: (id = ':orderId') => `/procurement/orders/${id}`,
    schedules: '/procurement/schedules', // OX: /app/procurement/schedules
  },

  personnel: {
    root: '/personnel',
    employees: '/personnel/employees', // OX: /app/personal-management/users
    newEmployee: '/personnel/employees/new',
    employeeDetail: (id = ':employeeId') => `/personnel/employees/${id}`,
    editEmployee: (id = ':employeeId') => `/personnel/employees/${id}/edit`,
    roles: '/personnel/roles', // OX: /app/personal-management/roles
    roleDetail: (id = ':roleId') => `/personnel/roles/${id}`,
  },

  /** OX nests these under a second in-module menu; we surface them directly. */
  marketing: {
    root: '/marketing',
    clients: '/marketing/clients', // OX: /app/marketing/customers
    newClient: '/marketing/clients/new',
    clientDetail: (id = ':clientId') => `/marketing/clients/${id}`,
    editClient: (id = ':clientId') => `/marketing/clients/${id}/edit`,
    promotions: '/marketing/promotions', // OX: /app/marketing/promotions
    newPromotion: '/marketing/promotions/new',
    editPromotion: (id = ':promotionId') => `/marketing/promotions/${id}`,
  },

  analytics: {
    root: '/analytics',
    reports: '/analytics/reports', // OX: /app/statistics/reports
    newReport: '/analytics/reports/new',
    reportView: (id = ':reportId') => `/analytics/reports/${id}`,
    editReport: (id = ':reportId') => `/analytics/reports/${id}/edit`,
    productLogs: '/analytics/product-logs', // OX: /app/statistics/stock-count-histories
    customers: '/analytics/customers', // OX: /app/statistics/customer-reports
  },

  uploads: '/uploads', // OX: /app/exports

  settings: {
    root: '/settings',
    general: '/settings/general', // OX: Основные
    brands: '/settings/brands',
    equipment: '/settings/equipment',
    locations: '/settings/locations',
    sales: '/settings/sales',
    products: '/settings/products',
    clients: '/settings/clients',
    billing: '/settings/billing',
    personal: '/settings/personal', // OX: Личные данные
  },

  activityLog: '/activity-log',
  notFound: '*',
} as const
