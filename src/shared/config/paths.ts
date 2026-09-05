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
    orderDetail: (id = ':orderId') => `/sales/orders/${id}`,
    drafts: '/sales/drafts', // OX: /app/sells/drafts
    deleted: '/sales/deleted', // OX: /app/sells/deleted
    postponed: '/sales/postponed', // OX: /app/sells/postpones
  },

  products: {
    root: '/products',
    list: '/products/list', // OX: /app/products/management
    detail: (id = ':productId') => `/products/list/${id}`,
    transfers: '/products/transfers', // OX: /app/products/transfers
    corrections: '/products/corrections', // OX: /app/products/corrections
    stocktaking: '/products/stocktaking', // OX: /app/products/reviews
    goodsReceipt: '/products/goods-receipt', // OX: /app/products/imports
    repricing: '/products/repricing', // OX: /app/products/reprices
    printTemplates: '/products/print-templates', // OX: /app/products/stickers
    suppliers: '/products/suppliers', // OX: /app/products/suppliers
    supplierDetail: (id = ':supplierId') => `/products/suppliers/${id}`,
  },

  procurement: {
    root: '/procurement',
    selection: '/procurement/selection', // OX: /app/procurement/selection
    orders: '/procurement/orders', // OX: /app/procurement/orders
    orderDetail: (id = ':orderId') => `/procurement/orders/${id}`,
    schedules: '/procurement/schedules', // OX: /app/procurement/schedules
  },

  personnel: {
    root: '/personnel',
    employees: '/personnel/employees', // OX: /app/personal-management/users
    employeeDetail: (id = ':employeeId') => `/personnel/employees/${id}`,
    motivation: '/personnel/motivation', // OX: /app/personal-management/motivations
    planning: '/personnel/planning', // OX: /app/personal-management/list/target
    roles: '/personnel/roles', // OX: /app/personal-management/roles
    roleDetail: (id = ':roleId') => `/personnel/roles/${id}`,
  },

  /** OX nests these under a second in-module menu; we surface them directly. */
  finance: {
    root: '/finance',
    dashboard: '/finance/dashboard',
    transactions: '/finance/transactions',
    contracts: '/finance/contracts',
    invoices: '/finance/invoices',
    budget: '/finance/budget',
    scenarios: '/finance/scenarios',
    pnl: '/finance/reports/pnl',
    cashflow: '/finance/reports/cashflow',
    receivables: '/finance/reports/receivables',
    payables: '/finance/reports/payables',
    forecast: '/finance/reports/forecast',
    settlements: '/finance/reports/employee-settlements',
    accounts: '/finance/accounts',
    categories: '/finance/categories',
    periodLock: '/finance/period-lock',
    taxes: '/finance/taxes',
  },

  marketing: {
    root: '/marketing',
    clients: '/marketing/clients', // OX: /app/marketing/customers
    clientDetail: (id = ':clientId') => `/marketing/clients/${id}`,
    groups: '/marketing/groups', // OX: /app/marketing/groups
    cashback: '/marketing/cashback', // OX: /app/marketing/cashbacks
    sms: '/marketing/sms', // OX: /app/marketing/newsletters
    digital: '/marketing/digital', // OX: /app/marketing/digital-mass-messaging
    promotions: '/marketing/promotions', // OX: /app/marketing/promotions
    coupons: '/marketing/coupons', // OX: /app/marketing/coupon-collections
  },

  analytics: {
    root: '/analytics',
    reportBuilder: '/analytics/reports', // OX: /app/statistics/reports
    reportDetail: (id = ':reportId') => `/analytics/reports/${id}`,
    productLogs: '/analytics/product-logs', // OX: /app/statistics/stock-count-histories
    storefront: '/analytics/storefront', // OX: /app/statistics/utm-reports
    sales: '/analytics/sales', // OX: /app/statistics/sell-reports
    customers: '/analytics/customers', // OX: /app/statistics/customer-reports
    promotions: '/analytics/promotions', // OX: /app/statistics/promotion-report
    calls: '/analytics/calls', // OX: /app/statistics/call-history
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
