import { Fuel, Milestone, Pencil, SquareParking, Trash2, type LucideIcon } from 'lucide-react'
import { IconTile, PhoneSheet, SheetBadge, SheetButtons, SheetNote } from './phone'
import { M, TONES, type MobileTone } from './palette'

/*
  The three states a spend record can be opened in: as entered, after it was
  deleted, and after it was edited. A record is never overwritten — the older
  version stays in the history and stops counting — which is what these sheets
  are for, so they are drawn as three separate screens.
*/

/** The line every sheet opens with: what was spent, on what, when, how much. */
function RecordLine({
  icon,
  tone,
  title,
  meta,
  date,
  amount,
  struck,
}: {
  icon: LucideIcon
  tone: MobileTone
  title: string
  meta?: string
  date: string
  amount: string
  struck?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <IconTile icon={icon} tone={tone} shape="square" />
      <div className="min-w-0 flex-1">
        <p
          className="text-[14px] font-bold"
          style={{ color: M.text, textDecoration: struck ? 'line-through' : undefined }}
        >
          {title}
        </p>
        {meta ? (
          <p className="text-[12px]" style={{ color: M.textMuted }}>
            {meta}
          </p>
        ) : null}
        <p className="text-[12px]" style={{ color: M.textSubtle }}>
          {date}
        </p>
      </div>
      <span
        className="text-[15px] font-bold"
        style={{
          color: struck ? M.textSubtle : TONES.red.fg,
          textDecoration: struck ? 'line-through' : undefined,
        }}
      >
        {amount}
      </span>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between border-t py-2.5 text-[13px]"
      style={{ borderColor: M.divider }}
    >
      <span style={{ color: M.textMuted }}>{label}</span>
      <span className="font-bold" style={{ color: M.text }}>
        {value}
      </span>
    </div>
  )
}

const SectionTitle = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="mt-4">
    <p className="text-[14px] font-bold" style={{ color: M.text }}>
      {title}
    </p>
    {hint ? (
      <p className="text-[11px]" style={{ color: M.textSubtle }}>
        {hint}
      </p>
    ) : null}
  </div>
)

/** 1. A record as it stands: what it is, who added it, and what can be done. */
export function OperationSheet({ onClose }: { onClose: () => void }) {
  return (
    <PhoneSheet
      onClose={onClose}
      title="Детали записи"
      footer={
        <SheetButtons
          primary={
            <span className="inline-flex items-center gap-1.5">
              <Pencil className="size-3.5" />
              Редактировать
            </span>
          }
          danger="Удалить расход"
          note="При удалении запись останется в истории, но перестанет учитываться в расходах."
        />
      }
    >
      <SectionTitle title="Текущая версия" />
      <RecordLine
        icon={Fuel}
        tone="green"
        title="Топливо"
        meta="Дизель · 1 850 л"
        date="09.09.2026"
        amount="−$652,00"
      />
      <FieldRow label="Категория" value="Топливо" />
      <FieldRow label="Кто добавил" value="Шохруз Сафаров" />
      <SheetNote>В общие расходы входит только текущая версия: $652,00</SheetNote>
    </PhoneSheet>
  )
}

/** 2. A deleted record: why it is struck through, and the trail it left. */
export function DeletedOperationSheet({ onClose }: { onClose: () => void }) {
  return (
    <PhoneSheet
      onClose={onClose}
      title="Детали записи"
      badge={<SheetBadge label="Удалено" tone="red" />}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-full place-items-center rounded-2xl text-[13px] font-semibold"
          style={{ background: M.text, color: M.card }}
        >
          Закрыть
        </button>
      }
    >
      <div
        className="mt-2 flex items-start gap-2.5 rounded-2xl p-3"
        style={{ background: TONES.red.soft }}
      >
        <Trash2 className="mt-0.5 size-4 shrink-0" style={{ color: TONES.red.fg }} />
        <div>
          <p className="text-[13px] font-bold" style={{ color: TONES.red.fg }}>
            Расход удалён
          </p>
          <p className="text-[12px]" style={{ color: M.textMuted }}>
            Удалил: Шохруз Сафаров · Владелец автопарка
          </p>
          <p className="text-[12px]" style={{ color: M.textSubtle }}>
            14.09.2026, 14:42
          </p>
          <p className="mt-1 text-[12px]" style={{ color: M.textMuted }}>
            Запись сохраняется в истории и не входит в общие расходы.
          </p>
        </div>
      </div>

      <div
        className="mt-3 rounded-2xl border px-3 pb-3"
        style={{ borderColor: M.border, background: M.card }}
      >
        <RecordLine
          icon={Fuel}
          tone="green"
          title="Топливо"
          date="14.09.2026"
          amount="−$1 212,00"
          struck
        />
        <div className="border-t pt-2" style={{ borderColor: M.divider }}>
          <p className="text-[11px]" style={{ color: M.textSubtle }}>
            Дата
          </p>
          <p className="text-[13px] font-semibold" style={{ color: M.text }}>
            14.09.2026
          </p>
          <span className="mt-2 inline-block">
            <SheetBadge label="Недействительна" tone="red" />
          </span>
        </div>
      </div>

      <SectionTitle title="История записи" hint="Все действия сохраняются." />
      <Timeline
        entries={[
          {
            label: 'Создано',
            tone: 'blue',
            who: 'Шохруз Сафаров · Владелец автопарка',
            at: '14.09.2026, 09:58',
            detail: 'Топливо · −$1 212,00',
          },
          {
            label: 'Удалено',
            tone: 'red',
            who: 'Шохруз Сафаров · Владелец автопарка',
            at: '14.09.2026, 14:42',
          },
        ]}
      />
    </PhoneSheet>
  )
}

function Timeline({
  entries,
}: {
  entries: { label: string; tone: MobileTone; who: string; at: string; detail?: string }[]
}) {
  return (
    <div className="mt-2 pl-3">
      {entries.map((entry, index) => (
        <div
          key={entry.label}
          className="relative pb-4 pl-5"
          style={{
            borderLeft: index === entries.length - 1 ? 'none' : `1px solid ${M.border}`,
          }}
        >
          <span
            className="absolute top-1 -left-[4.5px] size-2 rounded-full"
            style={{ background: TONES[entry.tone].fg }}
          />
          <p className="text-[13px] font-bold" style={{ color: M.text }}>
            {entry.label}
          </p>
          <p className="text-[12px]" style={{ color: M.textMuted }}>
            {entry.who}
          </p>
          <p className="text-[12px]" style={{ color: M.textSubtle }}>
            {entry.at}
          </p>
          {entry.detail ? (
            <p className="text-[12px]" style={{ color: M.textMuted }}>
              {entry.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** 3. An edited record: the version that counts, and the one it replaced. */
export function EditedOperationSheet({ onClose }: { onClose: () => void }) {
  return (
    <PhoneSheet
      onClose={onClose}
      title="Расход #EXP-002481"
      badge={<SheetBadge label="Изменено" tone="yellow" />}
      footer={
        <SheetButtons
          primary="Редактировать"
          danger="Удалить расход"
          note="При удалении запись останется в истории, но перестанет учитываться."
        />
      }
    >
      <SectionTitle title="Текущая версия" />
      <RecordLine
        icon={Milestone}
        tone="purple"
        title="Платная дорога"
        meta="Трасса М-5"
        date="29.08.2026"
        amount="−$40,00"
      />
      <div className="border-t pt-2" style={{ borderColor: M.divider }}>
        <p className="text-[11px]" style={{ color: M.textSubtle }}>
          Комментарий
        </p>
        <p className="text-[13px]" style={{ color: M.text }}>
          Оплата проезда по трассе М-5
        </p>
      </div>
      <SheetNote>В общих расходах учитывается только текущая версия: $40,00</SheetNote>

      <SectionTitle title="История изменений" hint="Предыдущие данные не удаляются." />
      <Version
        badge={<SheetBadge label="Заменено" tone="red" />}
        icon={SquareParking}
        tone="green"
        title="Стоянка"
        meta="Стоянка Дустлик"
        who="Добавил Мансурбек · Водитель"
        at="04.09.2026, 14:18"
        amount="−$20,00"
        struck
      />
      <div className="py-1 text-center">
        <p className="text-[14px]" style={{ color: M.textSubtle }}>
          ↓
        </p>
        <p className="text-[11px]" style={{ color: M.textSubtle }}>
          Изменено
        </p>
      </div>
      <Version
        badge={<SheetBadge label="Текущая" tone="green" />}
        icon={Milestone}
        tone="purple"
        title="Платная дорога"
        meta="Трасса М-5"
        who="Изменил Mansurjons · Владелец автопарка"
        at="05.09.2026, 09:30"
        amount="−$40,00"
        reason="Причина: неверно выбрана категория расхода."
        current
      />
    </PhoneSheet>
  )
}

function Version({
  badge,
  icon,
  tone,
  title,
  meta,
  who,
  at,
  amount,
  reason,
  struck,
  current,
}: {
  badge: React.ReactNode
  icon: LucideIcon
  tone: MobileTone
  title: string
  meta: string
  who: string
  at: string
  amount: string
  reason?: string
  struck?: boolean
  current?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: current ? M.card : M.screen,
        border: `1px solid ${current ? TONES.green.fg : M.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tone={tone} shape="square" size="sm" />
        <div className="min-w-0 flex-1">
          {badge}
          <p
            className="mt-1 text-[13px] font-bold"
            style={{ color: M.text, textDecoration: struck ? 'line-through' : undefined }}
          >
            {title}
          </p>
          <p
            className="text-[12px]"
            style={{ color: M.textMuted, textDecoration: struck ? 'line-through' : undefined }}
          >
            {meta}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: M.textMuted }}>
            {who}
          </p>
          <p className="text-[11px]" style={{ color: M.textSubtle }}>
            {at}
          </p>
        </div>
        <span
          className="text-[13px] font-bold"
          style={{
            color: struck ? M.textSubtle : TONES.red.fg,
            textDecoration: struck ? 'line-through' : undefined,
          }}
        >
          {amount}
        </span>
      </div>
      {reason ? (
        <p
          className="mt-2 border-t pt-2 text-[12px]"
          style={{ borderColor: M.divider, color: M.textMuted }}
        >
          {reason}
        </p>
      ) : null}
    </div>
  )
}
