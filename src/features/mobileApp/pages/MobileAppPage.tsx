import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Coins,
  Container,
  Droplets,
  Fuel,
  Gauge,
  Map,
  Milestone,
  MoreHorizontal,
  Power,
  Receipt,
  Route,
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

const OPERATIONS: {
  title: string
  note: string
  by: string
  amount: string
  icon: LucideIcon
  tone: MobileTone
  state: OperationState
}[] = [
  {
    title: 'Топливо',
    note: '',
    by: '14.09.2026 · Шохруз Сафаров',
    amount: '−$1 212,00',
    icon: Fuel,
    tone: 'green',
    state: 'deleted',
  },
  {
    title: 'Платная дорога',
    note: 'Трасса М-5',
    by: '05.09.2026 · Mansurjons',
    amount: '−$40,00',
    icon: Milestone,
    tone: 'purple',
    state: 'edited',
  },
  {
    title: 'Зарплата',
    note: 'создано',
    by: '09.09.2026 · Шохруз Сафаров',
    amount: '−$652,00',
    icon: Coins,
    tone: 'yellow',
    state: 'current',
  },
  {
    title: 'Топливо',
    note: 'отказ',
    by: '09.09.2026 · Шохруз Сафаров',
    amount: '−$1 000,00',
    icon: Fuel,
    tone: 'green',
    state: 'current',
  },
  {
    title: 'Топливо',
    note: '',
    by: '08.09.2026 · Шохруз Сафаров',
    amount: '−$10,00',
    icon: Fuel,
    tone: 'green',
    state: 'current',
  },
  {
    title: 'Зарплата',
    note: 'Привет',
    by: '08.09.2026 · Шохруз Сафаров',
    amount: '−$120,00',
    icon: Coins,
    tone: 'yellow',
    state: 'current',
  },
]

const SPEND_SPLIT = [
  { label: 'Топливо', operations: '3 операции', amount: '$1 130,00', share: 59 },
  { label: 'Зарплата', operations: '2 операции', amount: '$772,00', share: 41 },
]

const TRIPS: {
  from: string
  to: string
  fromAddress: string
  toAddress: string
  meta: string
  amount: string
  status: 'Завершён' | 'Отменён'
}[] = [
  {
    from: 'Ташкент',
    to: 'Ташкент',
    fromAddress: 'Чиланзарский район…',
    toAddress: 'улица Шериат Боғи',
    meta: '11.09.2026 · 2 км · 5 мин · Расход: $0,00',
    amount: '$12,00',
    status: 'Завершён',
  },
  {
    from: 'Ташкент',
    to: 'Ташкент',
    fromAddress: 'Чиланзарский район…',
    toAddress: 'улица Самарканд…',
    meta: '09.09.2026 · 3 км · 5 мин · Расход: $0,00',
    amount: '$0,00',
    status: 'Отменён',
  },
  {
    from: 'Ташкент',
    to: 'Ташкентс…',
    fromAddress: 'Чиланзарский район…',
    toAddress: 'махаллинский сход п…',
    meta: '09.09.2026 · 5 км · 9 мин · Расход: $0,00',
    amount: '$121,00',
    status: 'Завершён',
  },
  {
    from: 'Ташкент',
    to: 'Ташкент',
    fromAddress: 'Шайхантахурский рай…',
    toAddress: 'Юнусабадский райо…',
    meta: '08.09.2026 · 6 км · 9 мин · Расход: $10,00',
    amount: '$150,00',
    status: 'Завершён',
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
          <Statistics />
          <Finance onOpen={setOpen} />
          <SpendSplit />
          <Trips />
          <Mileage />
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
          className="grid h-[132px] w-[104px] shrink-0 place-items-center rounded-2xl"
          style={{ background: TONES.grey.soft }}
        >
          <Truck className="size-9" style={{ color: M.textSubtle }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[15px] leading-snug font-bold" style={{ color: M.text }}>
              {TRUCK.make}
              <br />
              {TRUCK.model}
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
          <dl className="mt-2 divide-y" style={{ borderColor: M.divider }}>
            <Spec icon={Calendar} value={TRUCK.year} label="Год" />
            <Spec icon={Container} value={TRUCK.kind} label="Тип" />
            <Spec icon={Gauge} value={TRUCK.odometer} label="Пробег" />
          </dl>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-3" style={{ borderColor: M.border }}>
        <Container className="size-7 shrink-0" style={{ color: M.textSubtle }} />
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
      className="mt-2 inline-flex h-9 items-stretch overflow-hidden rounded-lg border-2"
      style={{ borderColor: M.text, background: M.card }}
    >
      <span className="grid w-9 place-items-center text-[13px] font-bold" style={{ color: M.text }}>
        {TRUCK.region}
      </span>
      <span
        className="grid flex-1 place-items-center border-x-2 px-2 text-[14px] font-bold tracking-wide"
        style={{ borderColor: M.text, color: M.text }}
      >
        {TRUCK.plate}
      </span>
      <span className="grid w-7 place-items-center">
        <span className="flex h-4 w-5 flex-col overflow-hidden rounded-[2px]">
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
    <div className="flex items-center gap-2.5 py-2">
      {/* Black, like the design — not the back office's blue. */}
      <Icon className="size-4 shrink-0" style={{ color: M.text }} />
      <div className="leading-tight">
        <dd className="text-[13px] font-bold" style={{ color: M.text }}>
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

        <div className="divide-y" style={{ borderColor: M.divider }}>
          {OPERATIONS.map((operation, index) => (
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
    <PhoneSection
      title="Куда уходят расходы"
      subtitle="Структура расходов"
      action={
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
          style={{ background: M.card, borderColor: M.border, color: M.textMuted }}
        >
          Последний месяц
          <ChevronRight className="size-3 rotate-90" />
        </span>
      }
    >
      <PhoneCard>
        <Donut />
        <div
          className="mt-4 flex items-center justify-between text-[10px]"
          style={{ color: M.textSubtle }}
        >
          <span>Категория</span>
          <span>Сумма · Доля</span>
        </div>
        <div className="mt-1.5 space-y-1.5">
          {SPEND_SPLIT.map((slice, index) => (
            <div key={slice.label} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: index === 0 ? TONES.green.fg : TONES.orange.fg }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold" style={{ color: M.text }}>
                  {slice.label}
                </p>
                <p className="text-[10px]" style={{ color: M.textSubtle }}>
                  {slice.operations}
                </p>
              </div>
              <span className="text-[12px] font-bold" style={{ color: M.text }}>
                {slice.amount}
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ background: TONES.grey.soft, color: M.textMuted }}
              >
                {slice.share}%
              </span>
            </div>
          ))}
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

/** Two slices, drawn as one stroked circle each — no chart library on a mock. */
function Donut() {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const first = (SPEND_SPLIT[0]!.share / 100) * circumference
  return (
    <div className="relative mx-auto size-40">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="18"
          stroke={TONES.green.fg}
          strokeDasharray={`${first} ${circumference - first}`}
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="18"
          stroke={TONES.orange.fg}
          strokeDasharray={`${circumference - first} ${first}`}
          strokeDashoffset={-first}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-[10px]" style={{ color: M.textSubtle }}>
          Всего расходов
        </p>
        <p className="text-[18px] font-bold" style={{ color: M.text }}>
          $1 902,00
        </p>
        <p className="text-[10px]" style={{ color: M.textSubtle }}>
          5 операций
        </p>
      </div>
    </div>
  )
}

function Trips() {
  return (
    <PhoneSection
      title="Последние рейсы"
      action={
        <span className="inline-flex items-center text-[11px]" style={{ color: M.textMuted }}>
          Показать все
          <ChevronRight className="size-3.5" />
        </span>
      }
    >
      <div
        className="mx-3 divide-y rounded-2xl border"
        style={{ background: M.card, borderColor: M.border }}
      >
        {TRIPS.map((trip, index) => (
          <div key={index} className="px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="flex items-center gap-1.5 text-[12px] font-semibold"
                  style={{ color: M.text }}
                >
                  <Flag />
                  {trip.from}
                  <ChevronRight className="size-3" style={{ color: M.textSubtle }} />
                  <Flag />
                  {trip.to}
                </p>
                <p className="mt-1 truncate text-[10px]" style={{ color: M.textSubtle }}>
                  {trip.fromAddress} → {trip.toAddress}
                </p>
                <p className="mt-0.5 text-[10px]" style={{ color: M.textSubtle }}>
                  {trip.meta}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-bold" style={{ color: M.text }}>
                  {trip.amount}
                </p>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]"
                  style={
                    trip.status === 'Завершён'
                      ? { background: TONES.green.soft, color: TONES.green.fg }
                      : { background: TONES.red.soft, color: TONES.red.fg }
                  }
                >
                  {trip.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PhoneSection>
  )
}

const Flag = () => (
  <span
    className="rounded px-1 py-px text-[9px] font-semibold"
    style={{ background: TONES.grey.soft, color: M.textMuted }}
  >
    UZ
  </span>
)

function Mileage() {
  return (
    <PhoneSection title="История пробега">
      <PhoneCard>
        <div className="flex items-center gap-2">
          <Gauge className="size-4" style={{ color: M.textSubtle }} />
          <span className="flex-1 text-[12px]" style={{ color: M.textMuted }}>
            Текущий пробег
          </span>
          <span className="text-[13px] font-bold" style={{ color: M.text }}>
            200 000 км
          </span>
        </div>
        <p
          className="mt-3 border-t pt-3 text-center text-[11px]"
          style={{ borderColor: M.divider, color: M.textSubtle }}
        >
          История пробега пока пуста
        </p>
      </PhoneCard>
    </PhoneSection>
  )
}

function AssignmentHistory() {
  return (
    <PhoneSection title="История прикреплений">
      <PhoneCard padded={false}>
        <p
          className="px-3.5 pt-3 text-[10px] tracking-wide uppercase"
          style={{ color: M.textSubtle }}
        >
          Прицепы
        </p>
        <HistoryRow
          title="WIELTON · 60 W 286 AA"
          meta="Рефрижератор"
          period="08.09.2026 — сейчас"
          current
        />
        <HistoryRow title="KOGEL · 01 980 ABB" meta="Тент" period="02.08.2026 — 08.09.2026" />
        <HistoryRow title="KOGEL · 01 980 ABB" meta="Тент" period="14.07.2026 — 02.08.2026" />
      </PhoneCard>
    </PhoneSection>
  )
}

function HistoryRow({
  title,
  meta,
  period,
  current,
}: {
  title: string
  meta: string
  period: string
  current?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-2 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: M.text }}>
          {title}
        </p>
        {meta ? (
          <p className="text-[10px]" style={{ color: M.textSubtle }}>
            {meta}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px]" style={{ color: M.textSubtle }}>
          {period}
        </p>
        {current ? (
          <span
            className="inline-flex items-center gap-1 text-[10px]"
            style={{ color: TONES.green.fg }}
          >
            <span className="size-1.5 rounded-full" style={{ background: TONES.green.fg }} />
            Текущий
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Documents() {
  return (
    <PhoneSection title="Документы" className="pb-2">
      <div className="px-3">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed text-[13px] font-semibold"
          style={{ borderColor: M.border, color: M.textMuted, background: M.card }}
        >
          Добавить документ
        </button>
        <p className="mt-3 text-center text-[11px]" style={{ color: M.textSubtle }}>
          Документов пока нет
        </p>
      </div>
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
