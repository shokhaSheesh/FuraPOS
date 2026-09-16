import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Camera,
  ChevronRight,
  Clock,
  Coins,
  Container,
  Droplets,
  FileText,
  Fuel,
  Gauge,
  Map,
  Milestone,
  Package,
  MapPin,
  Plus,
  RefreshCw,
  Scale,
  MoreHorizontal,
  Power,
  Receipt,
  Route,
  ShieldCheck,
  SquareParking,
  Truck,
  User,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader'
import { cn } from '@/shared/lib/cn'
import { M, TONES, type MobileTone } from '../components/palette'
import {
  IconTile,
  Phone,
  PhoneCard,
  PhoneChips,
  PhoneHeader,
  PhoneSection,
  SheetBadge,
} from '../components/phone'
import {
  DeletedOperationSheet,
  EditedOperationSheet,
  OperationSheet,
} from '../components/OperationSheets'

/*
  A mock of the fleet app's "my truck" screen — a different product from this
  back office, parked here so it can be reviewed without a second repo. It is
  the *driver's* own screen, which is why nothing here assigns a driver: the
  person holding the phone is the driver. Fixed Russian copy, no store.
*/

const TRUCK = {
  make: 'Mercedes-Benz',
  model: 'Actros MP3',
  state: 'В рейсе',
  region: '60',
  plate: 'W 999 AA',
  year: '2013',
  kind: 'Тягач',
  odometer: '200 000 км',
  trailer: { model: 'WIELTON', plate: '60 W 286 AA', kind: 'Рефрижератор' },
}

const STATUSES: {
  label: string
  hint: string
  icon: LucideIcon
  tone: MobileTone
  active?: boolean
}[] = [
  { label: 'Офлайн', hint: 'Геолокация отключена', icon: Power, tone: 'grey' },
  { label: 'Ремонт', hint: 'Геолокация отключена', icon: Wrench, tone: 'blue' },
  { label: 'Ожидание', hint: 'Геолокация включена', icon: Clock, tone: 'orange' },
  { label: 'В рейсе', hint: 'Геолокация включена', icon: Truck, tone: 'green', active: true },
]

const QUICK_EXPENSES: { label: string; icon: LucideIcon; tone: MobileTone }[] = [
  { label: 'Топливо', icon: Fuel, tone: 'green' },
  { label: 'Стоянка', icon: SquareParking, tone: 'blue' },
  { label: 'Еда', icon: UtensilsCrossed, tone: 'red' },
  { label: 'Мойка', icon: Droplets, tone: 'purple' },
  { label: 'Штраф', icon: Receipt, tone: 'orange' },
  { label: 'Прочее', icon: MoreHorizontal, tone: 'grey' },
]

/**
 * The trip under way. Only on the screen while the truck's status is "В рейсе"
 * — parked or in the workshop there is nothing to show.
 */
const CURRENT_TRIP = {
  number: 'Рейс #TR-1048',
  from: { code: 'UZ', city: 'Ташкент', address: 'Чиланзарский район, проспект Бунёдкор, 7' },
  to: { code: 'DE', city: 'Берлин', address: 'Tempelhof, Ordensmeisterstraße 15' },
  done: '2 840',
  total: '4 600 км',
  percent: 62,
  elapsed: '3 дня',
  cargo: 'Яблоки',
  weight: '20 т',
  distance: '4 600 км',
  income: '$5 800',
  spend: '$2 150',
  eta: '1 день 8 ч',
  place: 'Казахстан, трасса М-36',
  updated: 'Обновлено 30 сек назад',
}

const PERIODS = [
  { value: 'month', label: 'Этот месяц' },
  { value: 'prev', label: 'Прошлый месяц' },
] as const

/** The headline figures — money first, then what the truck actually did. */
const MONEY_STATS: { label: string; value: string; tone: MobileTone; badge: MobileTone }[] = [
  { label: 'Доход', value: '8 400', tone: 'green', badge: 'green' },
  { label: 'Расход', value: '3 120', tone: 'red', badge: 'red' },
  { label: 'Прибыль', value: '5 280', tone: 'yellow', badge: 'green' },
]

const WORK_STATS: { label: string; value: string; unit?: string; icon: LucideIcon }[] = [
  { label: 'Рейсы', value: '5', icon: Truck },
  { label: 'Время ожидания', value: '2', unit: 'дня', icon: Clock },
  { label: 'Пройденный путь', value: '7 840', unit: 'км', icon: Route },
]

/**
 * Individual entries, newest first. `state` is what opens when one is tapped:
 * a record as entered, one that was deleted, or one that was edited — the
 * three things a spend record can be.
 */
type OperationState = 'current' | 'deleted' | 'edited'

/** What the Тип расхода chips filter by. */
type SpendCategory = 'fuel' | 'salary' | 'toll'

const CATEGORY_FILTERS: { value: SpendCategory | 'all'; label: string; icon?: LucideIcon }[] = [
  { value: 'all', label: 'Все' },
  { value: 'fuel', label: 'Топливо', icon: Fuel },
  { value: 'salary', label: 'Зарплата', icon: Coins },
  { value: 'toll', label: 'Платные дороги', icon: Milestone },
]

const OPERATIONS: {
  title: string
  note: string
  by: string
  amount: string
  icon: LucideIcon
  tone: MobileTone
  category: SpendCategory
  state: OperationState
}[] = [
  {
    title: 'Топливо',
    note: '',
    by: '14.09.2026 · Шохруз Сафаров',
    amount: '−$1 212,00',
    icon: Fuel,
    tone: 'green',
    category: 'fuel',
    state: 'deleted',
  },
  {
    title: 'Платная дорога',
    note: 'Трасса М-5',
    by: '05.09.2026 · Mansurjons',
    amount: '−$40,00',
    icon: Milestone,
    tone: 'purple',
    category: 'toll',
    state: 'edited',
  },
  {
    title: 'Зарплата',
    note: 'создано',
    by: '09.09.2026 · Шохруз Сафаров',
    amount: '−$652,00',
    icon: Coins,
    tone: 'yellow',
    category: 'salary',
    state: 'current',
  },
  {
    title: 'Топливо',
    note: 'отказ',
    by: '09.09.2026 · Шохруз Сафаров',
    amount: '−$1 000,00',
    icon: Fuel,
    tone: 'green',
    category: 'fuel',
    state: 'current',
  },
  {
    title: 'Топливо',
    note: '',
    by: '08.09.2026 · Шохруз Сафаров',
    amount: '−$10,00',
    icon: Fuel,
    tone: 'green',
    category: 'fuel',
    state: 'current',
  },
  {
    title: 'Зарплата',
    note: 'Привет',
    by: '08.09.2026 · Шохруз Сафаров',
    amount: '−$120,00',
    icon: Coins,
    tone: 'yellow',
    category: 'salary',
    state: 'current',
  },
]

const SPEND_SPLIT: {
  label: string
  operations: string
  amount: string
  share: number
  icon: LucideIcon
  tone: MobileTone
  /** The slice's colour, which follows the design's order rather than the icon's. */
  slice: MobileTone
}[] = [
  {
    label: 'Топливо',
    operations: '5 операций',
    amount: '$1 850',
    share: 59.3,
    icon: Fuel,
    tone: 'green',
    slice: 'green',
  },
  {
    label: 'Платные дороги',
    operations: '8 операций',
    amount: '$520',
    share: 16.7,
    icon: Milestone,
    tone: 'blue',
    slice: 'blue',
  },
  {
    label: 'Еда',
    operations: '19 операций',
    amount: '$310',
    share: 9.9,
    icon: UtensilsCrossed,
    tone: 'red',
    slice: 'red',
  },
  {
    label: 'Стоянка',
    operations: '12 операций',
    amount: '$240',
    share: 7.7,
    icon: SquareParking,
    tone: 'blue',
    slice: 'orange',
  },
  {
    label: 'Мойка',
    operations: '5 операций',
    amount: '$200',
    share: 6.4,
    icon: Droplets,
    tone: 'purple',
    slice: 'purple',
  },
]

const SPEND_TOTAL = { amount: '$3 120', operations: '49 операций' }

const TRIPS: {
  from: { country: Country; city: string }
  to: { country: Country; city: string }
  meta: string
  amount: string
  status: 'В дороге' | 'Завершён'
}[] = [
  {
    from: { country: 'UZ', city: 'Ташкент' },
    to: { country: 'DE', city: 'Берлин' },
    meta: '09.09.2026 · 4 600 км · 4 дня · Расход: $2 150',
    amount: '$5 800',
    status: 'В дороге',
  },
  {
    from: { country: 'UZ', city: 'Ташкент' },
    to: { country: 'KZ', city: 'Шымкент' },
    meta: '04.09.2026 · 153 км · 2 ч 52 мин · Расход: $180',
    amount: '$620',
    status: 'Завершён',
  },
  {
    from: { country: 'KZ', city: 'Алматы' },
    to: { country: 'UZ', city: 'Ташкент' },
    meta: '01.09.2026 · 810 км · 13 ч · Расход: $540',
    amount: '$1 450',
    status: 'Завершён',
  },
  {
    from: { country: 'UZ', city: 'Ташкент' },
    to: { country: 'UZ', city: 'Самарканд' },
    meta: '29.08.2026 · 305 км · 5 ч · Расход: $250',
    amount: '$530',
    status: 'Завершён',
  },
]

/** Which trailer was on the truck, and when. */
const TRAILER_HISTORY = [
  {
    title: 'WIELTON · 60 W 286 AA',
    kind: 'Рефрижератор',
    period: '08.09.2026 — сейчас',
    current: true,
  },
  { title: 'KOGEL · 01 980 ABB', kind: 'Тент', period: '02.08.2026 — 08.09.2026' },
  { title: 'KOGEL · 01 980 ABB', kind: 'Тент', period: '14.07.2026 — 02.08.2026' },
]

/** The papers that have to be in the cab, and how long each is good for. */
const DOCUMENTS: {
  title: string
  number: string
  icon: LucideIcon
  status: 'Действует' | 'Скоро истекает'
  until: string
}[] = [
  {
    title: 'Свидетельство о регистрации',
    number: '№ 01 AA 234567',
    icon: FileText,
    status: 'Действует',
    until: 'Бессрочно',
  },
  {
    title: 'Страховой полис',
    number: 'POL-009872',
    icon: ShieldCheck,
    status: 'Действует',
    until: 'до 12.03.2027',
  },
  {
    title: 'Техосмотр',
    number: 'ТО-2026-144',
    icon: Wrench,
    status: 'Скоро истекает',
    until: 'до 20.10.2026',
  },
]

const TABS: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: 'Рейсы', icon: Route },
  { label: 'Карта', icon: Map },
  { label: 'Расходы', icon: BarChart3 },
  { label: 'Машина', icon: Truck, active: true },
  { label: 'Профиль', icon: User },
]

/**
 * Mobile app — the fleet app's "Моя машина" screen, shown as a phone.
 *
 * It sits in this project only so there is one place to review it; it is a
 * different product and shares no data with the back office. The screen is a
 * picture, not a prototype: chips, statuses and rows are drawn in their chosen
 * state rather than reacting, which is what a design review needs. The screens
 * behind the taps come next.
 */
export default function MobileAppPage() {
  /** Which operation's sheet is open, if any — the only state on the mock. */
  const [open, setOpen] = useState<OperationState | null>(null)

  return (
    <>
      <PageHeader
        title="Mobile app"
        description="A design mock of the fleet app — a separate product from this back office. Tap an operation to open its record."
      />

      <div className="mt-4 flex justify-center pb-10">
        <Phone
          tabBar={<TabBar />}
          sheet={open ? SHEETS[open]({ onClose: () => setOpen(null) }) : undefined}
          onDismissSheet={() => setOpen(null)}
          header={
            <PhoneHeader
              title="Моя машина"
              left={
                <span
                  className="grid size-9 place-items-center rounded-xl border"
                  style={{ borderColor: M.border, background: M.card }}
                >
                  <ArrowLeft className="size-4" style={{ color: M.text }} />
                </span>
              }
            />
          }
        >
          <div className="pt-3" />
          <TruckCard />
          <Status />
          <QuickExpenses />
          <NewTrip />
          <CaptureOdometer />
          <CurrentTrip />
          <Statistics />
          <Finance onOpen={setOpen} />
          <SpendSplit />
          <Trips />
          <AssignmentHistory />
          <Documents />
        </Phone>
      </div>
    </>
  )
}

/** Which sheet a tapped operation opens. */
const SHEETS: Record<OperationState, (props: { onClose: () => void }) => React.ReactNode> = {
  current: OperationSheet,
  deleted: DeletedOperationSheet,
  edited: EditedOperationSheet,
}

function TruckCard() {
  return (
    <PhoneCard padded={false}>
      <div className="flex gap-3 p-3">
        {/* The photo slot: a real truck picture goes here in the app. */}
        <div
          className="grid h-[108px] w-[92px] shrink-0 place-items-center rounded-2xl"
          style={{ background: TONES.grey.soft }}
        >
          <Truck className="size-8" style={{ color: M.textSubtle }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[14px] leading-tight font-bold" style={{ color: M.text }}>
              {TRUCK.make} {TRUCK.model}
            </p>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: TONES.green.soft, color: TONES.green.fg }}
            >
              <span className="size-1.5 rounded-full" style={{ background: TONES.green.fg }} />
              {TRUCK.state}
            </span>
          </div>
          <Plate />
          <dl className="mt-1 divide-y" style={{ borderColor: M.divider }}>
            <Spec icon={Calendar} value={TRUCK.year} label="Год" />
            <Spec icon={Container} value={TRUCK.kind} label="Тип" />
            <Spec icon={Gauge} value={TRUCK.odometer} label="Пробег" />
          </dl>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-3" style={{ borderColor: M.border }}>
        <Container className="size-6 shrink-0" style={{ color: M.textSubtle }} />
        <div className="min-w-0">
          <p className="text-[11px]" style={{ color: M.textSubtle }}>
            Прицеп
          </p>
          <p className="text-[13px] font-bold" style={{ color: M.text }}>
            {TRUCK.trailer.model} <span style={{ color: M.textSubtle }}>·</span>{' '}
            {TRUCK.trailer.plate}
          </p>
          <p className="text-[11px]" style={{ color: M.textSubtle }}>
            {TRUCK.trailer.kind}
          </p>
        </div>
      </div>
    </PhoneCard>
  )
}

/** The number plate as a plate: region block, number, and the country flag. */
function Plate() {
  return (
    <div
      className="mt-1.5 inline-flex h-7 items-stretch overflow-hidden rounded-lg border-2"
      style={{ borderColor: M.text, background: M.card }}
    >
      <span className="grid w-9 place-items-center text-[13px] font-bold" style={{ color: M.text }}>
        {TRUCK.region}
      </span>
      <span
        className="grid flex-1 place-items-center border-x-2 px-2 text-[13px] font-bold tracking-wide"
        style={{ borderColor: M.text, color: M.text }}
      >
        {TRUCK.plate}
      </span>
      <span className="grid w-6 place-items-center">
        <span className="flex h-3.5 w-4 flex-col overflow-hidden rounded-[2px]">
          <span className="flex-1 bg-[#0099b5]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#1eb53a]" />
        </span>
      </span>
    </div>
  )
}

function Spec({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {/* Black, like the design — not the back office's blue. */}
      <Icon className="size-4 shrink-0" style={{ color: M.text }} />
      <div className="leading-tight">
        <dd className="text-[12.5px] font-bold" style={{ color: M.text }}>
          {value}
        </dd>
        <dt className="text-[10px]" style={{ color: M.textSubtle }}>
          {label}
        </dt>
      </div>
    </div>
  )
}

function Status() {
  return (
    <PhoneSection>
      <PhoneCard>
        <p className="text-[15px] font-bold" style={{ color: M.text }}>
          Статус
        </p>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {STATUSES.map((status) => (
            <div
              key={status.label}
              className="rounded-2xl border p-2 text-center"
              style={{
                background: TONES[status.tone].soft,
                borderColor: status.active ? TONES[status.tone].fg : 'transparent',
              }}
            >
              <status.icon className="mx-auto size-5" style={{ color: TONES[status.tone].fg }} />
              <p className="mt-1.5 text-[11px] font-bold" style={{ color: M.text }}>
                {status.label}
              </p>
              <p
                className="mt-0.5 text-[9px] leading-tight"
                style={{ color: TONES[status.tone].fg }}
              >
                {status.hint}
              </p>
            </div>
          ))}
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

function QuickExpenses() {
  return (
    <PhoneSection>
      <PhoneCard>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold" style={{ color: M.text }}>
            Быстрый расход
          </p>
          <span className="inline-flex items-center text-[11px]" style={{ color: M.textMuted }}>
            Показать все
            <ChevronRight className="size-3.5" />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {QUICK_EXPENSES.map((expense) => (
            <div key={expense.label} className="text-center">
              <div className="flex justify-center">
                <IconTile icon={expense.icon} tone={expense.tone} shape="square" />
              </div>
              <p className="mt-1.5 text-[10px] leading-tight" style={{ color: M.textMuted }}>
                {expense.label}
              </p>
            </div>
          ))}
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

/** The trip under way: where it goes, how far along it is, and where the truck is now. */
function CurrentTrip() {
  const inTrip = STATUSES.find((status) => status.active)?.label === 'В рейсе'
  if (!inTrip) return null

  return (
    <PhoneSection>
      <div className="mb-2 flex items-center gap-2 px-4">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: TONES.green.soft, color: TONES.green.fg }}
        >
          <span className="size-1.5 rounded-full" style={{ background: TONES.green.fg }} />В рейсе
        </span>
        <span className="text-[13px] font-semibold" style={{ color: M.textMuted }}>
          {CURRENT_TRIP.number}
        </span>
      </div>

      <PhoneCard>
        <div className="flex items-center gap-2">
          <IconTile icon={Route} tone="blue" size="sm" shape="square" />
          <p className="text-[15px] font-bold" style={{ color: M.text }}>
            Маршрут
          </p>
        </div>

        <Waypoint
          label="Пункт отправления"
          tone="blue"
          code={CURRENT_TRIP.from.code}
          city={CURRENT_TRIP.from.city}
          address={CURRENT_TRIP.from.address}
        />
        <p className="py-1 text-center text-[14px]" style={{ color: M.textSubtle }}>
          ↓
        </p>
        <Waypoint
          label="Пункт назначения"
          tone="purple"
          code={CURRENT_TRIP.to.code}
          city={CURRENT_TRIP.to.city}
          address={CURRENT_TRIP.to.address}
        />

        <div className="mt-3 flex items-baseline justify-between text-[12px]">
          <span style={{ color: M.textSubtle }}>
            <span className="font-bold" style={{ color: M.text }}>
              {CURRENT_TRIP.done}
            </span>{' '}
            / {CURRENT_TRIP.total}
          </span>
          <span className="font-semibold" style={{ color: TONES.blue.fg }}>
            {CURRENT_TRIP.percent}%
          </span>
          <span style={{ color: M.textSubtle }}>
            В пути{' '}
            <span className="font-bold" style={{ color: M.text }}>
              {CURRENT_TRIP.elapsed}
            </span>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full" style={{ background: M.screen }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${CURRENT_TRIP.percent}%`, background: TONES.blue.fg }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x" style={{ borderColor: M.divider }}>
          <TripFact icon={Package} tone="grey" label="Груз" value={CURRENT_TRIP.cargo} />
          <TripFact icon={Scale} tone="green" label="Вес" value={CURRENT_TRIP.weight} />
          <TripFact icon={Route} tone="purple" label="Расстояние" value={CURRENT_TRIP.distance} />
        </div>

        <div
          className="mt-3 grid grid-cols-3 items-center gap-2 border-t pt-3"
          style={{ borderColor: M.divider }}
        >
          <div>
            <p className="text-[11px]" style={{ color: M.textSubtle }}>
              Доход
            </p>
            <p className="text-[16px] font-bold" style={{ color: TONES.green.fg }}>
              {CURRENT_TRIP.income}
            </p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: M.textSubtle }}>
              Расход
            </p>
            <p className="text-[16px] font-bold" style={{ color: TONES.red.fg }}>
              {CURRENT_TRIP.spend}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 shrink-0" style={{ color: M.textSubtle }} />
            <div>
              <p className="text-[11px]" style={{ color: M.textSubtle }}>
                До прибытия
              </p>
              <p className="text-[13px] font-bold" style={{ color: M.text }}>
                {CURRENT_TRIP.eta}
              </p>
            </div>
          </div>
        </div>
      </PhoneCard>

      <PhoneCard className="mt-2.5">
        <p className="text-[15px] font-bold" style={{ color: M.text }}>
          Местоположение
        </p>
        <MiniMap />
        <div className="mt-2.5 flex items-center gap-2">
          <MapPin className="size-4 shrink-0" style={{ color: M.textSubtle }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold" style={{ color: M.text }}>
              {CURRENT_TRIP.place}
            </p>
            <p
              className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap"
              style={{ color: TONES.green.fg }}
            >
              <span className="size-1.5 rounded-full" style={{ background: TONES.green.fg }} />
              {CURRENT_TRIP.updated}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold"
            style={{ borderColor: M.border, color: TONES.blue.fg }}
          >
            <Map className="size-3.5" />
            Карта
            <ArrowRight className="size-3" />
          </span>
        </div>
        <button
          type="button"
          className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold"
          style={{ background: TONES.blue.soft, color: TONES.blue.fg }}
        >
          <RefreshCw className="size-3.5" />
          Обновить данные
        </button>
      </PhoneCard>
    </PhoneSection>
  )
}

/** One end of the route, boxed and tinted the way the design separates them. */
function Waypoint({
  label,
  tone,
  code,
  city,
  address,
}: {
  label: string
  tone: MobileTone
  code: string
  city: string
  address: string
}) {
  return (
    <div
      className="mt-2.5 rounded-2xl border p-2.5"
      style={{ borderColor: TONES[tone].fg, background: M.card }}
    >
      <p
        className="inline-flex items-center gap-1 text-[11px] font-medium"
        style={{ color: TONES[tone].fg }}
      >
        <MapPin className="size-3" />
        {label}
      </p>
      <p className="mt-1 flex items-center gap-1.5">
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: TONES[tone].fg, color: '#FFFFFF' }}
        >
          {code}
        </span>
        <span className="text-[15px] font-bold" style={{ color: M.text }}>
          {city}
        </span>
      </p>
      <p className="mt-0.5 text-[12px]" style={{ color: M.textSubtle }}>
        {address}
      </p>
    </div>
  )
}

function TripFact({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon
  tone: MobileTone
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 px-1.5 first:pl-0 last:pr-0">
      <IconTile icon={Icon} tone={tone} size="sm" shape="square" />
      <div className="min-w-0">
        <p className="text-[10px]" style={{ color: M.textSubtle }}>
          {label}
        </p>
        <p className="truncate text-[12px] font-bold" style={{ color: M.text }}>
          {value}
        </p>
      </div>
    </div>
  )
}

/**
 * The map is drawn, not fetched: a mock has no tiles, and a grey rectangle
 * would not show what the card is for — the route, and where on it the truck is.
 */
function MiniMap() {
  return (
    <div
      className="relative mt-2.5 h-28 overflow-hidden rounded-2xl"
      style={{ background: '#EDF1E6' }}
    >
      <svg viewBox="0 0 320 112" className="size-full">
        <path
          d="M0 76 C 60 70, 90 40, 150 44 S 260 30, 320 22"
          fill="none"
          stroke="#A9B79A"
          strokeWidth="1"
        />
        <path
          d="M20 96 C 80 92, 120 66, 190 56 S 280 40, 316 34"
          fill="none"
          stroke="#7C8B93"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <circle cx="66" cy="94" r="2.5" fill="#FFFFFF" stroke="#7C8B93" />
        <circle cx="150" cy="78" r="2.5" fill="#FFFFFF" stroke="#7C8B93" />
        <circle cx="236" cy="62" r="2.5" fill="#FFFFFF" stroke="#7C8B93" />
        <text x="60" y="106" fontSize="7" fill="#6B7280">
          Узбекистан
        </text>
        <text x="130" y="92" fontSize="7" fill="#6B7280">
          Шымкент
        </text>
        <text x="216" y="56" fontSize="7" fill="#6B7280">
          Алматы
        </text>
        <text x="140" y="22" fontSize="8" fill="#4B5563" fontWeight="600">
          Казахстан
        </text>
      </svg>
      <span
        className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
        style={{ background: TONES.blue.fg, boxShadow: `0 0 0 6px ${TONES.blue.soft}` }}
      >
        <Truck className="size-4" style={{ color: '#FFFFFF' }} />
      </span>
    </div>
  )
}

/** Starting a trip is the driver's other big action, so it gets the yellow. */
function NewTrip() {
  return (
    <PhoneSection>
      <PhoneCard>
        <p className="text-[15px] font-bold" style={{ color: M.text }}>
          Рейсы
        </p>
        <button
          type="button"
          className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold"
          style={{ background: M.cta, color: M.text }}
        >
          <Plus className="size-4" />
          Новый рейс
        </button>
      </PhoneCard>
    </PhoneSection>
  )
}

/** Photograph the odometer — the one thing only the driver in the cab can do. */
function CaptureOdometer() {
  return (
    <PhoneSection>
      <PhoneCard>
        <button type="button" className="flex w-full items-center gap-3 text-left">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${TONES.orange.fg}, #FFD54A)` }}
          >
            <Camera className="size-5" style={{ color: '#FFFFFF' }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold" style={{ color: M.text }}>
              Зафиксировать пробег
            </span>
            <span className="block text-[13px]" style={{ color: M.textSubtle }}>
              Последний: {TRUCK.odometer}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0" style={{ color: M.textSubtle }} />
        </button>
      </PhoneCard>
    </PhoneSection>
  )
}

function Statistics() {
  return (
    <PhoneSection>
      <div className="px-3">
        <Segmented options={[...PERIODS]} value="month" ariaLabel="Период" />
      </div>
      <PhoneCard className="mt-3">
        <div className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-xl"
            style={{ background: TONES.grey.soft }}
          >
            <BarChart3 className="size-4" style={{ color: M.text }} />
          </span>
          <p className="text-[15px] font-bold" style={{ color: M.text }}>
            Показатели
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {MONEY_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-2.5"
              style={{ background: TONES[stat.tone].soft }}
            >
              <span
                className="grid size-7 place-items-center rounded-full"
                style={{ background: M.card }}
              >
                <ArrowUpRight
                  className={cn('size-3.5', stat.label === 'Доход' && 'rotate-90')}
                  style={{ color: TONES[stat.tone].fg }}
                />
              </span>
              <p className="mt-2 text-[11px]" style={{ color: M.textMuted }}>
                {stat.label}
              </p>
              <p className="mt-1 flex items-center gap-1.5">
                <span
                  className="grid size-4 place-items-center rounded-full text-[9px] font-bold"
                  style={{ background: TONES[stat.badge].fg, color: M.card }}
                >
                  $
                </span>
                <span className="text-[15px] font-bold" style={{ color: TONES[stat.badge].fg }}>
                  {stat.value}
                </span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {WORK_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-2.5"
              style={{ background: TONES.blue.soft }}
            >
              <stat.icon className="size-4" style={{ color: TONES.blue.fg }} />
              <p className="mt-2 text-[11px] leading-tight" style={{ color: M.textMuted }}>
                {stat.label}
              </p>
              <p className="mt-1 text-[15px] font-bold" style={{ color: M.text }}>
                {stat.value}
                {stat.unit ? (
                  <span className="ml-1 text-[11px] font-medium" style={{ color: M.textMuted }}>
                    {stat.unit}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

/** The two-period switch above the figures: one dark pill in a white track. */
function Segmented<T extends string>({
  options,
  value,
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-2xl border p-1"
      style={{ background: M.card, borderColor: M.border }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <span
            key={option.value}
            className="rounded-xl py-2 text-center text-[13px] font-semibold"
            style={{
              background: active ? M.text : 'transparent',
              color: active ? M.card : M.textMuted,
            }}
          >
            {option.label}
          </span>
        )
      })}
    </div>
  )
}

function Finance({ onOpen }: { onOpen: (state: OperationState) => void }) {
  const [category, setCategory] = useState<SpendCategory | 'all'>('all')
  const shown = OPERATIONS.filter((o) => category === 'all' || o.category === category)

  return (
    <PhoneSection>
      <PhoneCard padded={false}>
        <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
          <div>
            <p className="text-[15px] font-bold" style={{ color: M.text }}>
              Финансы грузовика
            </p>
            <p className="text-[11px]" style={{ color: M.textSubtle }}>
              Этот месяц
            </p>
          </div>
          <span className="inline-flex items-center text-[11px]" style={{ color: M.textMuted }}>
            Все расходы
            <ChevronRight className="size-3.5" />
          </span>
        </div>

        <p className="mt-3 px-3.5 text-[12px]" style={{ color: M.textSubtle }}>
          Тип расхода
        </p>
        <div className="mt-1.5">
          <PhoneChips
            options={CATEGORY_FILTERS}
            value={category}
            onChange={setCategory}
            ariaLabel="Тип расхода"
          />
        </div>

        <div className="divide-y" style={{ borderColor: M.divider }}>
          {shown.map((operation, index) => (
            <button
              type="button"
              key={index}
              onClick={() => onOpen(operation.state)}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <IconTile icon={operation.icon} tone={operation.tone} size="sm" />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[14px] font-bold"
                  style={{
                    color: operation.state === 'deleted' ? M.textSubtle : M.text,
                    textDecoration: operation.state === 'deleted' ? 'line-through' : undefined,
                  }}
                >
                  {operation.title}
                  {operation.state === 'deleted' ? (
                    <span className="ml-1.5 align-middle">
                      <SheetBadge label="Удалено" tone="red" />
                    </span>
                  ) : operation.state === 'edited' ? (
                    <span className="ml-1.5 align-middle">
                      <SheetBadge label="Изменено" tone="yellow" />
                    </span>
                  ) : null}
                </p>
                {operation.note ? (
                  <p className="truncate text-[13px]" style={{ color: M.textMuted }}>
                    {operation.note}
                  </p>
                ) : null}
                <p className="truncate text-[12px]" style={{ color: M.textSubtle }}>
                  {operation.by}
                </p>
              </div>
              <span
                className="text-[14px] font-bold"
                style={{
                  color: operation.state === 'deleted' ? M.textSubtle : TONES.red.fg,
                  textDecoration: operation.state === 'deleted' ? 'line-through' : undefined,
                }}
              >
                {operation.amount}
              </span>
              <ChevronRight className="size-4 shrink-0" style={{ color: M.textSubtle }} />
            </button>
          ))}
          {shown.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12px]" style={{ color: M.textSubtle }}>
              За этот период таких расходов нет
            </p>
          ) : null}
        </div>
      </PhoneCard>
      <div className="px-3">
        <div
          className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]"
          style={{ background: M.screen, color: M.textMuted }}
        >
          <span
            className="grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold"
            style={{ borderColor: M.textSubtle, color: M.textSubtle }}
          >
            i
          </span>
          Приход записывается на рейс — здесь только расходы.
        </div>
      </div>
    </PhoneSection>
  )
}

function SpendSplit() {
  return (
    <PhoneSection>
      <PhoneCard padded={false}>
        <div className="px-3.5 pt-3.5">
          <p className="text-[15px] font-bold" style={{ color: M.text }}>
            Куда уходят расходы
          </p>
          <p className="text-[11px]" style={{ color: M.textSubtle }}>
            Этот месяц
          </p>
        </div>

        <Donut />

        <div className="mt-1 divide-y" style={{ borderColor: M.divider }}>
          {SPEND_SPLIT.map((slice) => (
            <div key={slice.label} className="flex items-center gap-3 px-3.5 py-2.5">
              <IconTile icon={slice.icon} tone={slice.tone} size="sm" shape="square" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ color: M.text }}>
                  {slice.label}
                </p>
                <p className="text-[12px]" style={{ color: M.textSubtle }}>
                  {slice.operations}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold" style={{ color: M.text }}>
                  {slice.amount}
                </p>
                <p className="text-[12px]" style={{ color: M.textSubtle }}>
                  {slice.share.toFixed(1).replace('.', ',')}%
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0" style={{ color: M.textSubtle }} />
            </div>
          ))}
        </div>

        <div className="px-3.5 pt-2 pb-3.5">
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px]"
            style={{ background: M.screen, color: M.textMuted }}
          >
            <span
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold"
              style={{ borderColor: M.textSubtle, color: M.textSubtle }}
            >
              i
            </span>
            <span>
              Нажмите на категорию, чтобы открыть операции.
              <br />
              Удалённые расходы не учитываются в итогах.
            </span>
          </div>
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

/**
 * The ring, drawn by hand: one stroked arc per category with its share written
 * inside it. No chart library on a mock, and none of this back office's chart
 * palette either — the slice colours are the app's own.
 */
function Donut() {
  const radius = 72
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const slices = SPEND_SPLIT.map((slice) => {
    const length = (slice.share / 100) * circumference
    const midAngle = ((offset + length / 2) / circumference) * 360 - 90
    const radians = (midAngle * Math.PI) / 180
    const entry = {
      ...slice,
      length,
      offset,
      labelX: 100 + radius * Math.cos(radians),
      labelY: 100 + radius * Math.sin(radians),
    }
    offset += length
    return entry
  })

  return (
    <div className="relative mx-auto mt-2 size-[220px]">
      <svg viewBox="0 0 200 200" className="size-full">
        <g transform="rotate(-90 100 100)">
          {slices.map((slice) => (
            <circle
              key={slice.label}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              strokeWidth="24"
              stroke={TONES[slice.slice].fg}
              strokeDasharray={`${slice.length} ${circumference - slice.length}`}
              strokeDashoffset={-slice.offset}
            />
          ))}
        </g>
        {slices.map((slice) => (
          <text
            key={slice.label}
            x={slice.labelX}
            y={slice.labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontWeight="700"
            fill="#FFFFFF"
          >
            {slice.share.toFixed(1).replace('.', ',')}%
          </text>
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center px-12 text-center">
        <p className="text-[10px]" style={{ color: M.textMuted }}>
          Всего расходов
        </p>
        <p className="text-[19px] font-bold" style={{ color: M.text }}>
          {SPEND_TOTAL.amount}
        </p>
        <p className="text-[10px]" style={{ color: M.textSubtle }}>
          {SPEND_TOTAL.operations}
        </p>
      </div>
    </div>
  )
}

function Trips() {
  return (
    <PhoneSection>
      <PhoneCard padded={false}>
        <p className="px-3.5 pt-3.5 text-[15px] font-bold" style={{ color: M.text }}>
          Последние рейсы
        </p>
        <div className="mt-1 divide-y" style={{ borderColor: M.divider }}>
          {TRIPS.map((trip, index) => (
            <div key={index} className="px-3.5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Place country={trip.from.country} city={trip.from.city} />
                  <ArrowRight className="size-3 shrink-0" style={{ color: M.textSubtle }} />
                  <Place country={trip.to.country} city={trip.to.city} />
                </div>
                <span className="shrink-0 text-[14px] font-bold" style={{ color: M.text }}>
                  {trip.amount}
                </span>
                <ChevronRight className="size-4 shrink-0" style={{ color: M.textSubtle }} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[11px]" style={{ color: M.textSubtle }}>
                  {trip.meta}
                </p>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={
                    trip.status === 'Завершён'
                      ? { background: TONES.green.soft, color: TONES.green.fg }
                      : { background: TONES.orange.soft, color: TONES.orange.fg }
                  }
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      background: trip.status === 'Завершён' ? TONES.green.fg : TONES.orange.fg,
                    }}
                  />
                  {trip.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

type Country = 'UZ' | 'KZ' | 'DE'

/** The flag and where it is, as the design writes a leg: 🇺🇿 UZ · Ташкент. */
function Place({ country, city }: { country: Country; city: string }) {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1 text-[12.5px] whitespace-nowrap"
      style={{ color: M.text }}
    >
      <span style={{ color: M.textMuted }}>{country}</span>
      <span style={{ color: M.textSubtle }}>·</span>
      <span className="truncate font-semibold">{city}</span>
    </span>
  )
}

function AssignmentHistory() {
  return (
    <PhoneSection>
      <PhoneCard padded={false}>
        <p className="px-3.5 pt-3.5 text-[15px] font-bold" style={{ color: M.text }}>
          История прикреплений
        </p>
        <div className="mt-1 divide-y" style={{ borderColor: M.divider }}>
          {TRAILER_HISTORY.map((entry) => (
            <div key={entry.period} className="flex items-center gap-3 px-3.5 py-3">
              <IconTile icon={Container} tone="grey" size="sm" shape="square" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ color: M.text }}>
                  {entry.title}
                </p>
                <p className="text-[12px]" style={{ color: M.textSubtle }}>
                  {entry.kind}
                </p>
              </div>
              <div className="text-right">
                {entry.current ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: TONES.green.soft, color: TONES.green.fg }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: TONES.green.fg }}
                    />
                    Текущий
                  </span>
                ) : null}
                <p className="mt-0.5 text-[11px]" style={{ color: M.textSubtle }}>
                  {entry.period}
                </p>
              </div>
            </div>
          ))}
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

function Documents() {
  return (
    <PhoneSection className="pb-2">
      <PhoneCard padded={false}>
        <p className="px-3.5 pt-3.5 text-[15px] font-bold" style={{ color: M.text }}>
          Документы машины
        </p>
        <div className="mt-1 divide-y" style={{ borderColor: M.divider }}>
          {DOCUMENTS.map((document) => (
            <div key={document.title} className="flex items-center gap-3 px-3.5 py-3">
              <IconTile icon={document.icon} tone="grey" size="sm" shape="square" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ color: M.text }}>
                  {document.title}
                </p>
                <p className="text-[12px]" style={{ color: M.textSubtle }}>
                  {document.number}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={
                    document.status === 'Действует'
                      ? { background: TONES.green.soft, color: TONES.green.fg }
                      : { background: TONES.orange.soft, color: TONES.orange.fg }
                  }
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      background:
                        document.status === 'Действует' ? TONES.green.fg : TONES.orange.fg,
                    }}
                  />
                  {document.status}
                </span>
                <p className="mt-0.5 text-[11px]" style={{ color: M.textSubtle }}>
                  {document.until}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0" style={{ color: M.textSubtle }} />
            </div>
          ))}
        </div>
        <div className="px-3.5 pt-2 pb-3.5">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px]"
            style={{ background: M.screen, color: M.textMuted }}
          >
            <span
              className="grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold"
              style={{ borderColor: M.textSubtle, color: M.textSubtle }}
            >
              i
            </span>
            Документы добавляет и редактирует владелец автопарка.
          </div>
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

function TabBar() {
  return (
    <nav
      className="flex shrink-0 items-center justify-around border-t px-2 pt-2 pb-5"
      style={{ background: M.card, borderColor: M.border }}
    >
      {TABS.map((tab) => (
        <span
          key={tab.label}
          className={cn('flex flex-col items-center gap-1 text-[10px]', tab.active && 'font-bold')}
          style={{ color: tab.active ? M.text : M.textSubtle }}
        >
          <tab.icon className="size-5" />
          {tab.label}
        </span>
      ))}
    </nav>
  )
}
