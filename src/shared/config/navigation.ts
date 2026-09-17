import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  CircleUser,
  ClipboardList,
  Factory,
  FileChartColumn,
  FileSpreadsheet,
  FolderTree,
  Globe,
  Handshake,
  History,
  IdCard,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  PackagePlus,
  Printer,
  Receipt,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Tag,
  Tags,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { paths } from './paths'

export type NavBadge = 'new' | 'beta'

export interface NavItem {
  label: string
  to: string
  /** Grants required to see this item — `view` on the section it opens. */
  permission?: string
  badge?: NavBadge
  /** Exact match only (used for index routes that would otherwise stay active). */
  end?: boolean
  /** Shown beside the label, as the sections' own icons are. */
  icon?: LucideIcon
  /**
   * Optional heading rendered above this item. Used by Finance, which in OX
   * groups its pages under "ОТЧЕТЫ" and "НАСТРОЙКИ" headings.
   */
  group?: string
}

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  /** Present on single-page sections (Dashboard, Uploads, Support). */
  to?: string
  permission?: string
  badge?: NavBadge
  items?: NavItem[]
}

/**
 * The sidebar, top to bottom. Order, grouping and labels mirror OX System
 * one-for-one — see docs/OX-NAVIGATION-MAP.md for the correspondence.
 * Adding a screen means adding it here and to the router, nowhere else.
 */
export const navigation: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: paths.dashboard,
    permission: 'dashboard.view',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      {
        label: 'Offline sales',
        icon: Receipt,
        to: paths.sales.orders,
        permission: 'sales.orders.view',
      },
      {
        label: 'Online sales',
        icon: Globe,
        to: paths.sales.online,
        permission: 'sales.online.view',
      },
      {
        label: 'Partner orders',
        icon: Handshake,
        to: paths.sales.partnerOrders,
        permission: 'sales.partnerOrders.view',
      },
      {
        label: 'Cash shifts',
        icon: Wallet,
        to: paths.sales.shifts,
        permission: 'sales.cashShifts.view',
      },
    ],
  },
  {
    id: 'products',
    label: 'Products / Services',
    icon: Boxes,
    items: [
      {
        label: 'Product list',
        icon: Package,
        to: paths.products.list,
        permission: 'products.list.view',
      },
      {
        label: 'Transfers',
        icon: ArrowLeftRight,
        to: paths.products.transfers,
        permission: 'products.transfers.view',
      },
      {
        label: 'Corrections',
        icon: Wrench,
        to: paths.products.corrections,
        permission: 'products.corrections.view',
      },
      {
        label: 'Stocktaking',
        icon: ScanLine,
        to: paths.products.stocktaking,
        permission: 'products.stocktaking.view',
      },
      {
        label: 'Goods receipt',
        icon: PackagePlus,
        to: paths.products.goodsReceipt,
        permission: 'products.goodsReceipt.view',
      },
      {
        label: 'Repricing',
        icon: Tags,
        to: paths.products.repricing,
        permission: 'products.repricing.view',
      },
      {
        label: 'Print templates',
        icon: Printer,
        to: paths.products.printTemplates,
        permission: 'products.printTemplates.view',
      },
      {
        label: 'Suppliers',
        icon: Factory,
        to: paths.products.suppliers,
        permission: 'products.suppliers.view',
      },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    icon: Truck,
    badge: 'new',
    items: [
      {
        label: 'Orders',
        icon: ClipboardList,
        to: paths.procurement.orders,
        permission: 'procurement.orders.view',
      },
    ],
  },
  {
    id: 'personnel',
    label: 'Personnel management',
    icon: Users,
    items: [
      {
        label: 'Employees',
        icon: UserRound,
        to: paths.personnel.employees,
        permission: 'personnel.employees.view',
      },
      {
        label: 'Access & roles',
        icon: ShieldCheck,
        to: paths.personnel.roles,
        permission: 'personnel.roles.view',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      {
        label: 'Autoparks',
        icon: Building2,
        to: paths.marketing.autoparks,
        permission: 'marketing.clients.view',
      },
      {
        label: 'Drivers',
        icon: IdCard,
        to: paths.marketing.drivers,
        permission: 'marketing.drivers.view',
      },
      {
        label: 'Promotions',
        icon: BadgePercent,
        to: paths.marketing.promotions,
        permission: 'marketing.promotions.view',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    items: [
      {
        label: 'Report generator',
        icon: FileChartColumn,
        to: paths.analytics.reports,
        permission: 'analytics.reportBuilder.view',
      },
      {
        label: 'Product logs',
        icon: History,
        to: paths.analytics.productLogs,
        permission: 'analytics.productLogs.view',
      },
    ],
  },
  {
    // A design mock of the fleet phone app, parked here for review. It is a
    // different product: no permission gates it and it reads nothing.
    id: 'mobileApp',
    label: 'Mobile app',
    icon: Smartphone,
    to: paths.mobileApp,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      {
        label: 'General',
        icon: SlidersHorizontal,
        to: paths.settings.general,
        permission: 'settings.general.view',
      },
      { label: 'Brands', icon: Tag, to: paths.settings.brands, permission: 'settings.brands.view' },
      {
        label: 'Cash registers',
        icon: Calculator,
        to: paths.settings.registers,
        permission: 'settings.registers.view',
      },
      {
        label: 'Locations',
        icon: MapPin,
        to: paths.settings.locations,
        permission: 'settings.locations.view',
      },
      {
        label: 'Categories',
        icon: FolderTree,
        to: paths.settings.categories,
        permission: 'settings.products.view',
      },
      {
        label: 'Mass update',
        icon: FileSpreadsheet,
        to: paths.settings.massUpdate,
        permission: 'products.list.edit',
      },
      { label: 'Personal data', icon: CircleUser, to: paths.settings.personal },
    ],
  },
]
