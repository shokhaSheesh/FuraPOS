import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronRight,
  CircleParking,
  Clock,
  Container,
  Droplets,
  FileDown,
  Gauge,
  Map,
  Pencil,
  Phone as PhoneIcon,
  Plus,
  Route,
  ShieldAlert,
  Truck,
  User,
  UtensilsCrossed,
  Warehouse,
  Wifi,
  Wrench,
  Fuel,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { cn } from '@/shared/lib/cn'
import {
  IconTile,
  Phone,
  PhoneCard,
  PhoneChips,
  PhoneHeader,
  PhoneSection,
} from '../components/phone'

/*
  A mock of the fleet app's truck screen — a different product from this back
  office, parked here so it can be reviewed without a second repo. Everything
  below is fixed copy in Uzbek, exactly as the design has it; none of it reads
  the catalogue, and nothing in the back office reads it.
*/

const TRUCK = {
  model: 'VOLVO FH 12',
  plate: '01 232 ABA',
  state: 'Mavjud',
  year: '2020',
  kind: 'Shatakchi',
  odometer: '280,000 km',
}

const STATUSES: { label: string; hint: string; icon: LucideIcon; active?: boolean }[] = [
  { label: 'Offline', hint: 'Lokatsiya oʻchirilgan', icon: Wifi },
  { label: 'Taʼmir', hint: 'Lokatsiya oʻchirilgan', icon: Wrench },
  { label: 'Kutish', hint: 'Lokatsiya yoqilgan', icon: Clock, active: true },
  { label: 'Reysda', hint: 'Lokatsiya yoqilgan', icon: Route },
]

const QUICK_EXPENSES: {
  label: string
  icon: LucideIcon
  tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
}[] = [
  { label: 'Yoqilgʻi', icon: Fuel, tone: 'success' },
  { label: 'Ovqatlanish', icon: UtensilsCrossed, tone: 'warning' },
  { label: 'Toʻxtash j…', icon: CircleParking, tone: 'info' },
  { label: 'Jarima', icon: ShieldAlert, tone: 'danger' },
  { label: 'Yuvish', icon: Droplets, tone: 'neutral' },
]

const PERIODS = [
  { value: 'month', label: 'Bu oy' },
  { value: 'prev', label: 'Oʻtgan oy' },
  { value: 'year', label: 'Bu yil' },
  { value: 'all', label: 'Barcha vaqt' },
] as const

const FINANCE_PERIODS = [
  { value: 'm1', label: 'Oxirgi oy' },
  { value: 'm6', label: 'Oxirgi 6 oy' },
  { value: 'y1', label: 'Oxirgi yil' },
  { value: 'custom', label: 'Davr' },
] as const

const EXPENSE_TYPES = [
  { value: 'all', label: 'Barchasi' },
  { value: 'fuel', label: 'Yoqilgʻi' },
  { value: 'food', label: 'Ovqatlanish' },
  { value: 'parking', label: 'Toʻxtash…' },
] as const

const TRANSACTIONS: {
  title: string
  note: string
  by: string
  amount: string
  icon: LucideIcon
  tone: 'success' | 'warning'
  voided?: boolean
}[] = [
  {
    title: 'Yoqilgʻi',
    note: 'Oʻchirildi: Shohruz Safarov, 9/14/2026',
    by: 'Shohruz Safarov',
    amount: '−$1,212.00',
    icon: Fuel,
    tone: 'success',
    voided: true,
  },
  {
    title: 'Ish haqi',
    note: 'create',
    by: '9/9/2026 · Shohruz Safarov',
    amount: '−$652.00',
    icon: UtensilsCrossed,
    tone: 'warning',
  },
  {
    title: 'Yoqilgʻi',
    note: 'rad',
    by: '9/9/2026 · Shohruz Safarov',
    amount: '−$1,000.00',
    icon: Fuel,
    tone: 'success',
  },
  {
    title: 'Yoqilgʻi',
    note: '',
    by: '9/9/2026 · Shohruz Safarov',
    amount: '−$10.00',
    icon: Fuel,
    tone: 'success',
  },
  {
    title: 'Ish haqi',
    note: 'Hello',
    by: '9/8/2026 · Shohruz Safarov',
    amount: '−$120.00',
    icon: UtensilsCrossed,
    tone: 'warning',
  },
  {
    title: 'Yoqilgʻi',
    note: '',
    by: '9/8/2026 · Shohruz Safarov',
    amount: '−$120.00',
    icon: Fuel,
    tone: 'success',
  },
]

const SPEND_SPLIT = [
  { label: 'Yoqilgʻi', operations: '3 ta amaliyot', amount: '$1,130.00', share: 59 },
  { label: 'Ish haqi', operations: '2 ta amaliyot', amount: '$772.00', share: 41 },
]

const TRIPS: {
  from: string
  to: string
  fromAddress: string
  toAddress: string
  meta: string
  amount: string
  status: 'Tugatilgan' | 'Bekor qilingan'
}[] = [
  {
    from: 'Тошкент',
    to: 'Тошкент',
    fromAddress: 'Чиланзарский район…',
    toAddress: 'улица Шериат Боғи',
    meta: '9/11/2026 · 2 km · 5 min · Rasxod: $0.00',
    amount: '$12.00',
    status: 'Tugatilgan',
  },
  {
    from: 'Тошкент',
    to: 'Тошкент',
    fromAddress: 'Чиланзарский район…',
    toAddress: 'улица Самарканд…',
    meta: '9/9/2026 · 3 km · 5 min · Rasxod: $0.00',
    amount: '$0.00',
    status: 'Bekor qilingan',
  },
  {
    from: 'Тошкент',
    to: 'Тошкентс…',
    fromAddress: 'Чиланзарский район…',
    toAddress: 'махаллинский сход п…',
    meta: '9/9/2026 · 5 km · 9 min · Rasxod: $0.00',
    amount: '$121.00',
    status: 'Tugatilgan',
  },
  {
    from: 'Тошкент',
    to: 'Тошкент',
    fromAddress: 'Шайхантаҳурский рай…',
    toAddress: 'Юнусабадский райо…',
    meta: '9/8/2026 · 6 km · 9 min · Rasxod: $10.00',
    amount: '$150.00',
    status: 'Tugatilgan',
  },
]

const TABS: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: 'Reyslar', icon: Route },
  { label: 'Xarita', icon: Map },
  { label: 'Analitika', icon: BarChart3 },
  { label: 'Garaj', icon: Warehouse, active: true },
  { label: 'Profil', icon: User },
]

/**
 * Mobile app — the fleet app's truck screen, shown as a phone.
 *
 * It sits in this project only so there is one place to review it; it is a
 * different product and shares no data with the back office. The screen is a
 * picture, not a prototype: the chips, statuses and rows are drawn in their
 * chosen state rather than being interactive, which is what a design review
 * needs. The action screens behind the taps come next.
 */
export default function MobileAppPage() {
  return (
    <>
      <PageHeader
        title="Mobile app"
        description="A design mock of the fleet app — a separate product from this back office. Truck screen; the screens behind each action follow."
      />

      <div className="mt-4 flex justify-center pb-10">
        <Phone
          tabBar={<TabBar />}
          header={
            <PhoneHeader
              title="Yuk mashinasi"
              left={<ArrowLeft className="size-5" />}
              right={<Pencil className="size-4" />}
            />
          }
        >
          <div className="pt-3" />
          <TruckCard />
          <Assigned />
          <Status />
          <QuickExpenses />
          <Statistics />
          <Finance />
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

function TruckCard() {
  return (
    <PhoneCard>
      <div className="flex gap-3">
        {/* The photo slot: a real truck picture goes here in the app. */}
        <div className="bg-surface-muted text-fg-subtle grid size-24 shrink-0 place-items-center rounded-xl">
          <Truck className="size-10" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-fg text-[15px] leading-tight font-semibold">{TRUCK.model}</p>
            <span className="text-success inline-flex shrink-0 items-center gap-1 text-[11px] font-medium">
              <span className="bg-success size-1.5 rounded-full" />
              {TRUCK.state}
            </span>
          </div>
          <p className="text-fg-muted mt-0.5 text-[13px] tracking-wide">{TRUCK.plate}</p>
          <dl className="mt-2 space-y-1.5">
            <Spec icon={Calendar} value={TRUCK.year} label="Yil" />
            <Spec icon={Container} value={TRUCK.kind} label="Turi" />
            <Spec icon={Gauge} value={TRUCK.odometer} label="Yurgan masofa" />
          </dl>
        </div>
      </div>
    </PhoneCard>
  )
}

function Spec({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-fg-subtle size-3.5 shrink-0" />
      <div className="leading-tight">
        <dd className="text-fg text-[12px] font-medium">{value}</dd>
        <dt className="text-fg-subtle text-[10px]">{label}</dt>
      </div>
    </div>
  )
}

function Assigned() {
  return (
    <PhoneSection title="Biriktirilgan">
      <div className="grid grid-cols-2 gap-2.5 px-3">
        <div className="bg-surface border-border rounded-2xl border p-3">
          <div className="text-fg-muted flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              Haydovchi
            </span>
            <Pencil className="size-3.5" />
          </div>
          <p className="text-fg mt-2 text-[13px] font-semibold tracking-[0.2em]">S K U</p>
          <p className="text-fg-subtle mt-1 inline-flex items-center gap-1 text-[11px]">
            <PhoneIcon className="size-3" />
            +998 90 021 80 13
          </p>
        </div>
        <div className="bg-surface border-border rounded-2xl border p-3">
          <div className="text-fg-muted flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <Container className="size-3.5" />
              Tirkama
            </span>
            <Pencil className="size-3.5" />
          </div>
          <p className="text-fg mt-2 text-[13px] font-semibold">KOGEL</p>
          <p className="border-border text-fg-muted mt-1 inline-block rounded border px-1.5 py-0.5 text-[11px] tracking-wide">
            01 | 980 ABB
          </p>
        </div>
      </div>
    </PhoneSection>
  )
}

function Status() {
  return (
    <PhoneSection title="Status">
      <div className="grid grid-cols-4 gap-2 px-3">
        {STATUSES.map((status) => (
          <div
            key={status.label}
            className={cn(
              'rounded-2xl border p-2 text-center',
              status.active ? 'border-warning bg-warning-soft' : 'border-border bg-surface',
            )}
          >
            <status.icon
              className={cn('mx-auto size-4', status.active ? 'text-warning' : 'text-fg-subtle')}
            />
            <p
              className={cn(
                'mt-1.5 text-[11px] font-medium',
                status.active ? 'text-warning' : 'text-fg',
              )}
            >
              {status.label}
            </p>
            <p className="text-fg-subtle mt-0.5 text-[9px] leading-tight">{status.hint}</p>
          </div>
        ))}
      </div>
    </PhoneSection>
  )
}

function QuickExpenses() {
  return (
    <PhoneSection
      title="Tez xarajat qoʻshish"
      action={
        <span className="text-fg-muted inline-flex items-center text-[11px]">
          Xarajatlarni koʻrish
          <ChevronRight className="size-3.5" />
        </span>
      }
    >
      <div className="grid grid-cols-5 gap-1.5 px-3">
        {QUICK_EXPENSES.map((expense) => (
          <div key={expense.label} className="text-center">
            <div className="flex justify-center">
              <IconTile icon={expense.icon} tone={expense.tone} />
            </div>
            <p className="text-fg-muted mt-1.5 text-[10px] leading-tight">{expense.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 px-3">
        <button
          type="button"
          className="border-border text-fg-muted flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed text-[13px] font-medium"
        >
          <Plus className="size-4" />
          Reys qoʻshish
        </button>
      </div>
    </PhoneSection>
  )
}

function Statistics() {
  return (
    <PhoneSection>
      <PhoneCard>
        <p className="text-fg inline-flex items-center gap-2 text-[15px] font-semibold">
          <BarChart3 className="text-fg-muted size-4" />
          Statistika
        </p>
        <div className="-mx-3.5 mt-3">
          <PhoneChips options={[...PERIODS]} value="month" ariaLabel="Davr" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Money label="Kirim" value="283" tone="success" direction="down" />
          <Money label="Chiqim" value="1,902" tone="danger" direction="up" />
          <Money label="Foyda" value="-1,619" tone="danger" direction="up" />
        </div>
        <div className="border-border mt-3 grid grid-cols-3 gap-2 border-t pt-3">
          <Counter icon={Route} label="Reyslar" value="4" />
          <Counter icon={Clock} label="Kutish vaqti" value="0 kun" />
          <Counter icon={Gauge} label="Bosib oʻtilgan yoʻl" value="0 km" />
        </div>
      </PhoneCard>
    </PhoneSection>
  )
}

function Money({
  label,
  value,
  tone,
  direction,
}: {
  label: string
  value: string
  tone: 'success' | 'danger'
  direction: 'up' | 'down'
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-2.5 text-center',
        tone === 'success' ? 'bg-success-soft' : 'bg-danger-soft',
      )}
    >
      <ArrowUpRight
        className={cn(
          'mx-auto size-3.5',
          tone === 'success' ? 'text-success' : 'text-danger',
          direction === 'down' && 'rotate-90',
        )}
      />
      <p className="text-fg-muted mt-1 text-[10px]">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[15px] font-semibold',
          tone === 'success' ? 'text-success' : 'text-danger',
        )}
      >
        ${value}
      </p>
    </div>
  )
}

function Counter({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="text-fg-subtle mx-auto size-3.5" />
      <p className="text-fg mt-1 text-[14px] font-semibold">{value}</p>
      <p className="text-fg-subtle text-[10px] leading-tight">{label}</p>
    </div>
  )
}

function Finance() {
  return (
    <PhoneSection
      title="Yuk mashinasi moliyasi"
      subtitle="Shu yuk mashinasining xarajatlari"
      action={
        <span className="border-border text-fg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]">
          <FileDown className="size-3.5" />
          PDF eksport
        </span>
      }
    >
      <PhoneChips options={[...FINANCE_PERIODS]} value="m1" ariaLabel="Davr" />
      <p className="text-fg-subtle mt-3 px-4 text-[11px]">Xarajat turi</p>
      <div className="mt-1.5">
        <PhoneChips options={[...EXPENSE_TYPES]} value="all" ariaLabel="Xarajat turi" />
      </div>

      <div className="bg-surface border-border mx-3 mt-3 divide-y divide-[var(--color-border)] rounded-2xl border">
        {TRANSACTIONS.map((transaction, index) => (
          <div key={index} className="flex items-center gap-3 px-3.5 py-3">
            <IconTile icon={transaction.icon} tone={transaction.tone} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-fg truncate text-[13px] font-medium">
                {transaction.title}
                {transaction.voided ? (
                  <span className="text-danger ml-1.5 text-[10px] font-normal">Oʻchirilgan</span>
                ) : transaction.note ? (
                  <span className="text-fg-subtle ml-1.5 text-[11px] font-normal">
                    {transaction.note}
                  </span>
                ) : null}
              </p>
              <p className="text-fg-subtle truncate text-[10px]">{transaction.by}</p>
            </div>
            <span
              className={cn(
                'text-[13px] font-semibold',
                transaction.voided ? 'text-fg-subtle line-through' : 'text-danger',
              )}
            >
              {transaction.amount}
            </span>
            <ChevronRight className="text-fg-subtle size-4 shrink-0" />
          </div>
        ))}
      </div>
      <p className="text-fg-subtle mt-2 px-4 text-[10px]">
        Kirim reysga yoziladi — bu yerda faqat xarajatlar
      </p>
    </PhoneSection>
  )
}

function SpendSplit() {
  return (
    <PhoneSection
      title="Xarajatlar qayerga ketyapti"
      subtitle="Xarajatlar tarkibi"
      action={
        <span className="border-border text-fg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]">
          Oxirgi oy
          <ChevronRight className="size-3 rotate-90" />
        </span>
      }
    >
      <PhoneCard>
        <Donut />
        <div className="text-fg-subtle mt-4 flex items-center justify-between text-[10px]">
          <span>Kategoriya</span>
          <span>Summa · Ulush</span>
        </div>
        <div className="mt-1.5 space-y-1.5">
          {SPEND_SPLIT.map((slice, index) => (
            <div key={slice.label} className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  index === 0 ? 'bg-success' : 'bg-warning',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-fg text-[12px] font-medium">{slice.label}</p>
                <p className="text-fg-subtle text-[10px]">{slice.operations}</p>
              </div>
              <span className="text-fg text-[12px] font-semibold">{slice.amount}</span>
              <span className="bg-surface-muted text-fg-muted rounded-full px-1.5 py-0.5 text-[10px]">
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
          className="stroke-success"
          strokeDasharray={`${first} ${circumference - first}`}
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="18"
          className="stroke-warning"
          strokeDasharray={`${circumference - first} ${first}`}
          strokeDashoffset={-first}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-fg-subtle text-[10px]">Jami xarajat</p>
        <p className="text-fg text-[18px] font-semibold">$1,902.00</p>
        <p className="text-fg-subtle text-[10px]">5 ta amaliyot</p>
      </div>
    </div>
  )
}

function Trips() {
  return (
    <PhoneSection
      title="Soʻnggi reyslar"
      action={
        <span className="text-fg-muted inline-flex items-center text-[11px]">
          Barchasini koʻrish
          <ChevronRight className="size-3.5" />
        </span>
      }
    >
      <div className="bg-surface border-border mx-3 divide-y divide-[var(--color-border)] rounded-2xl border">
        {TRIPS.map((trip, index) => (
          <div key={index} className="px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-fg flex items-center gap-1.5 text-[12px] font-medium">
                  <Flag />
                  {trip.from}
                  <ChevronRight className="text-fg-subtle size-3" />
                  <Flag />
                  {trip.to}
                </p>
                <p className="text-fg-subtle mt-1 truncate text-[10px]">
                  {trip.fromAddress} → {trip.toAddress}
                </p>
                <p className="text-fg-subtle mt-0.5 text-[10px]">{trip.meta}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-fg text-[13px] font-semibold">{trip.amount}</p>
                <span
                  className={cn(
                    'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]',
                    trip.status === 'Tugatilgan'
                      ? 'bg-success-soft text-success'
                      : 'bg-danger-soft text-danger',
                  )}
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
  <span className="bg-surface-muted text-fg-muted rounded px-1 py-px text-[9px] font-semibold">
    UZ
  </span>
)

function Mileage() {
  return (
    <PhoneSection title="Probeg tarixi">
      <PhoneCard>
        <div className="flex items-center gap-2">
          <Gauge className="text-fg-subtle size-4" />
          <span className="text-fg-muted flex-1 text-[12px]">Joriy probeg</span>
          <span className="text-fg text-[13px] font-semibold">280,000 km</span>
        </div>
        <p className="text-fg-subtle border-border mt-3 border-t pt-3 text-center text-[11px]">
          Probeg tarixi hozircha yoʻq
        </p>
      </PhoneCard>
    </PhoneSection>
  )
}

function AssignmentHistory() {
  return (
    <PhoneSection title="Biriktirish tarixi">
      <PhoneCard padded={false}>
        <p className="text-fg-subtle px-3.5 pt-3 text-[10px] tracking-wide uppercase">
          Haydovchilar
        </p>
        <HistoryRow title="S K U" meta="+998 90 021 80 13" period="9/8/2026 — hozir" current />
        <HistoryRow title="—" meta="" period="9/8/2026 — 9/8/2026" />
        <HistoryRow title="—" meta="" period="9/8/2026 — 9/8/2026" />
        <p className="text-fg-subtle border-border border-t px-3.5 pt-3 text-[10px] tracking-wide uppercase">
          Tirkamalar
        </p>
        <HistoryRow title="01980ABB" meta="Universal" period="9/8/2026 — hozir" current />
        <HistoryRow title="01980ABB" meta="Universal" period="9/8/2026 — 9/8/2026" />
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
        <p className="text-fg text-[12px] font-medium">{title}</p>
        {meta ? <p className="text-fg-subtle text-[10px]">{meta}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-fg-subtle text-[10px]">{period}</p>
        {current ? (
          <span className="text-success inline-flex items-center gap-1 text-[10px]">
            <span className="bg-success size-1.5 rounded-full" />
            Joriy
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Documents() {
  return (
    <PhoneSection title="Hujjatlar" className="pb-2">
      <div className="px-3">
        <button
          type="button"
          className="border-border text-fg-muted flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed text-[13px] font-medium"
        >
          <Plus className="size-4" />
          Hujjat qoʻshish
        </button>
        <p className="text-fg-subtle mt-3 text-center text-[11px]">Hozircha hujjat yoʻq</p>
      </div>
    </PhoneSection>
  )
}

function TabBar() {
  return (
    <nav className="bg-surface border-border flex shrink-0 items-center justify-around border-t px-2 pt-2 pb-5">
      {TABS.map((tab) => (
        <span
          key={tab.label}
          className={cn(
            'flex flex-col items-center gap-1 text-[10px]',
            tab.active ? 'text-fg font-medium' : 'text-fg-subtle',
          )}
        >
          <tab.icon className="size-5" />
          {tab.label}
        </span>
      ))}
    </nav>
  )
}
