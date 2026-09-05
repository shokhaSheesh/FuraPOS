/**
 * Every route path in the app, in one place. Never hardcode a URL string in a
 * component — import from here so renames are a single edit and the nav tree,
 * the router and any <Link> can never drift apart.
 */
export const paths = {
  auth: {
    login: '/login',
    forgotPassword: '/forgot-password',
  },

  dashboard: '/',

  sales: {
    root: '/sales',
    all: '/sales',
    held: '/sales/held',
    detail: (id = ':saleId') => `/sales/${id}`,
    /** Hands off to the separate POS terminal app — not an in-app route. */
    newSaleLaunch: '/sales/new',
  },

  catalog: {
    root: '/catalog',
    products: '/catalog/products',
    productDetail: (id = ':productId') => `/catalog/products/${id}`,
    categories: '/catalog/categories',
    stock: '/catalog/stock',
    receipts: '/catalog/receipts',
    receiptDetail: (id = ':receiptId') => `/catalog/receipts/${id}`,
    adjustments: '/catalog/adjustments',
    transfers: '/catalog/transfers',
  },

  procurement: {
    root: '/procurement',
    orders: '/procurement/orders',
    orderDetail: (id = ':orderId') => `/procurement/orders/${id}`,
    suppliers: '/procurement/suppliers',
    supplierDetail: (id = ':supplierId') => `/procurement/suppliers/${id}`,
    reorder: '/procurement/reorder',
  },

  hr: {
    root: '/hr',
    employees: '/hr/employees',
    employeeDetail: (id = ':employeeId') => `/hr/employees/${id}`,
    roles: '/hr/roles',
    roleDetail: (id = ':roleId') => `/hr/roles/${id}`,
  },

  finance: {
    root: '/finance',
    pnl: '/finance/pnl',
    cashflow: '/finance/cashflow',
    receivables: '/finance/receivables',
    payables: '/finance/payables',
    forecast: '/finance/forecast',
    budgets: '/finance/budgets',
    settlements: '/finance/settlements',
    scenarios: '/finance/scenarios',
    categories: '/finance/categories',
  },

  marketing: {
    root: '/marketing',
    clients: '/marketing/clients',
    clientDetail: (id = ':clientId') => `/marketing/clients/${id}`,
    segments: '/marketing/segments',
    cashback: '/marketing/cashback',
    sms: '/marketing/sms',
    campaigns: '/marketing/campaigns',
    promotions: '/marketing/promotions',
    coupons: '/marketing/coupons',
  },

  analytics: {
    root: '/analytics',
    reports: '/analytics/reports',
    reportDetail: (id = ':reportId') => `/analytics/reports/${id}`,
    inventoryLog: '/analytics/inventory-log',
    storefront: '/analytics/storefront',
    sales: '/analytics/sales',
    customers: '/analytics/customers',
    promotions: '/analytics/promotions',
    calls: '/analytics/calls',
  },

  integrations: {
    root: '/integrations',
    detail: (id = ':integrationId') => `/integrations/${id}`,
  },

  uploads: '/uploads',

  referral: '/referral',

  settings: {
    root: '/settings',
    company: '/settings/company',
    brands: '/settings/brands',
    equipment: '/settings/equipment',
    locations: '/settings/locations',
    terminals: '/settings/sales/terminals',
    paymentMethods: '/settings/sales/payment-methods',
    salesFunnel: '/settings/sales/funnel',
    installments: '/settings/sales/installments',
    productCategories: '/settings/products/categories',
    receiptOptions: '/settings/products/receipt',
    bulkUpdate: '/settings/products/bulk-update',
    clientFields: '/settings/clients/fields',
    billing: '/settings/billing',
    profile: '/settings/profile',
    notifications: '/settings/notifications',
    webhooks: '/settings/webhooks',
    aiConnector: '/settings/ai-connector',
  },

  activityLog: '/activity-log',
  notFound: '*',
} as const
