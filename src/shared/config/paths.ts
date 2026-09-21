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
    /**
     * Where a sale is rung up: the till, a screen of its own outside the back
     * office. Every "New sale" in the product opens it.
     */
    newSale: '/pos',
    /** The till's cash desk: the drawer at each shop, and what was spent from it. */
    tillCash: '/pos/cash',
    orders: '/sales/orders', // OX: /app/sells/orders
    /**
     * A status view is the ledger with a filter, not a page of its own — the
     * chips on All sales write exactly this, so links and chips agree.
     */
    ordersByStatus: (status: string) => `/sales/orders?status=${status}`,
    orderDetail: (id = ':orderId') => `/sales/orders/${id}`,
    /** Cash shifts — OX: «Кассовые смены», /app/sells/cash-shifts. */
    shifts: '/sales/shifts',
    /** Orders another business placed with us. No OX equivalent. */
    partnerOrders: '/sales/partner-orders',
    partnerOrderDetail: (id = ':partnerOrderId') => `/sales/partner-orders/${id}`,
    /** Orders from the e-commerce app — view only. No OX equivalent. */
    online: '/sales/online',
    onlineDetail: (id = ':onlineSaleId') => `/sales/online/${id}`,
    shiftDetail: (id = ':shiftId') => `/sales/shifts/${id}`,
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
    /** An unfinished transfer, reopened where it was left. */
    editTransfer: (id = ':transferId') => `/products/transfers/${id}/edit`,
    corrections: '/products/corrections', // OX: /app/products/corrections
    newCorrection: '/products/corrections/new',
    correctionDetail: (id = ':correctionId') => `/products/corrections/${id}`,
    stocktaking: '/products/stocktaking', // OX: /app/products/reviews
    newStocktake: '/products/stocktaking/new',
    stocktakeDetail: (id = ':stocktakeId') => `/products/stocktaking/${id}`,
    goodsReceipt: '/products/goods-receipt', // OX: /app/products/imports
    goodsReceiptDetail: (id = ':receiptId') => `/products/goods-receipt/${id}`,
    goodsReceiptImport: (id = ':receiptId') => `/products/goods-receipt/${id}/import`,
    repricing: '/products/repricing', // OX: /app/products/reprices
    newRepricing: '/products/repricing/new',
    repricingDetail: (id = ':repricingId') => `/products/repricing/${id}`,
    printTemplates: '/products/print-templates', // OX: /app/products/stickers
    newPrintTemplate: '/products/print-templates/new',
    editPrintTemplate: (id = ':templateId') => `/products/print-templates/${id}`,
    suppliers: '/products/suppliers', // OX: /app/products/suppliers
    newSupplier: '/products/suppliers/new',
    supplierDetail: (id = ':supplierId') => `/products/suppliers/${id}`,
    editSupplier: (id = ':supplierId') => `/products/suppliers/${id}/edit`,
  },

  procurement: {
    root: '/procurement',
    orders: '/procurement/orders', // OX: /app/procurement/orders
    orderDetail: (id = ':orderId') => `/procurement/orders/${id}`,
    orderImport: (id = ':orderId') => `/procurement/orders/${id}/import`,
    /** The printable document for an order — outside the app shell, for saving as PDF. */
    orderDocument: (id = ':orderId') => `/procurement/orders/${id}/document`,
  },

  /** «Управление персоналом» in OX; renamed Users — everyone the business deals with by name. */
  users: {
    root: '/users',
    employees: '/users/employees', // OX: /app/personal-management/users
    newEmployee: '/users/employees/new',
    employeeDetail: (id = ':employeeId') => `/users/employees/${id}`,
    editEmployee: (id = ':employeeId') => `/users/employees/${id}/edit`,
    roles: '/users/roles', // OX: /app/personal-management/roles
    roleDetail: (id = ':roleId') => `/users/roles/${id}`,
    /** The haulage companies Fura holds contracts with. OX keeps them in Marketing, /app/marketing/customers. */
    autoparks: '/users/autoparks',
    newAutopark: '/users/autoparks/new',
    autoparkDetail: (id = ':clientId') => `/users/autoparks/${id}`,
    editAutopark: (id = ':clientId') => `/users/autoparks/${id}/edit`,
    drivers: '/users/drivers',
    driverDetail: (id = ':driverId') => `/users/drivers/${id}`,
  },

  /** OX nests these under a second in-module menu; we surface them directly. */
  marketing: {
    root: '/marketing',
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
  },

  settings: {
    root: '/settings',
    general: '/settings/general', // OX: Основные
    brands: '/settings/brands',
    registers: '/settings/registers',
    locations: '/settings/locations',
    categories: '/settings/categories', // OX: /app/settings/products
    massUpdate: '/settings/mass-update', // OX: /app/settings/products?currentTab=batch_update
    personal: '/settings/personal', // OX: Личные данные
  },

  /** A mock of a different product — the fleet phone app. Not part of the back office. */
  mobileApp: '/mobile-app',

  activityLog: '/activity-log',
  notFound: '*',
} as const
