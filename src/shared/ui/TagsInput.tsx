import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

/**
 * Free-form tags. Enter or comma commits the tag, Backspace on an empty field
 * removes the last one — the conventions people already expect from this
 * control, so nobody has to be told how it works.
 */
export function TagsInput({
  value,
  onChange,
  placeholder = 'Add a tag…',
  id,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  id?: string
}) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const tag = draft.trim().replace(/,$/, '')
    // Silently ignore duplicates rather than erroring: re-adding a tag that is
    // already there is a no-op in the user's head too.
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        'rounded-control border-border bg-surface flex min-h-9 flex-wrap items-center gap-1.5 border px-2 py-1',
        'focus-within:border-border-strong',
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="bg-surface-inset text-fg text-2xs inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="hover:text-danger text-fg-subtle"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        className="text-fg placeholder:text-fg-subtle min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  )
}
