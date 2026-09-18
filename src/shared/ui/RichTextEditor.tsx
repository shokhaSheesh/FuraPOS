import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { Select } from './Select'
import { cn } from '@/shared/lib/cn'
import { t } from '@/shared/i18n'

/**
 * A small formatted-text field — bold, italic, headings, lists, links.
 *
 * Product descriptions are read by customers in the storefront, so they need
 * more than one run of plain text. The value is **HTML**, kept deliberately
 * narrow: `sanitizeHtml` below is what decides which tags and attributes can
 * survive a round trip, and anything else is dropped rather than stored.
 *
 * The editing surface is `contentEditable` rather than a library: this is a
 * design deliverable with no backend, and a real build should swap this for a
 * proper editor before it takes untrusted input.
 */

const BLOCKS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
] as const

/** Tags a description may contain. Everything else is unwrapped or removed. */
const ALLOWED = new Set([
  'P',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'A',
  'DIV',
  'SPAN',
])

/**
 * Strips everything that is not plain formatting: scripts and styles go with
 * their contents, unknown tags are unwrapped, and only `href` survives — and
 * only when it is http(s) or mailto.
 */
export function sanitizeHtml(html: string): string {
  if (typeof document === 'undefined') return html
  const root = document.createElement('div')
  root.innerHTML = html

  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
        child.remove()
        continue
      }
      walk(child)
      for (const attribute of [...child.attributes]) {
        const keep =
          child.tagName === 'A' &&
          attribute.name === 'href' &&
          /^(https?:|mailto:)/i.test(attribute.value.trim())
        if (!keep) child.removeAttribute(attribute.name)
      }
      if (!ALLOWED.has(child.tagName)) child.replaceWith(...child.childNodes)
      else if (child.tagName === 'A') {
        child.setAttribute('target', '_blank')
        child.setAttribute('rel', 'noreferrer')
      }
    }
  }
  walk(root)
  return root.innerHTML
}

/** The text without its markup — for a table cell, a search index or a CSV. */
export function plainText(html: string | null): string {
  if (!html) return ''
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ')
  const root = document.createElement('div')
  root.innerHTML = html
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function RichTextEditor({
  value,
  onChange,
  id,
  placeholder = t('Describe the product…'),
  className,
}: {
  /** HTML. Null and empty string both mean "nothing written yet". */
  value: string | null
  onChange: (html: string | null) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const editor = useRef<HTMLDivElement>(null)
  const [block, setBlock] = useState<string>('p')

  /*
    The surface is uncontrolled: writing back on every keystroke would move the
    caret to the end. It is synced only when the value differs from what is
    already in the DOM — a different product opened into the same form.
  */
  useEffect(() => {
    const node = editor.current
    if (!node) return
    const next = value ?? ''
    if (node.innerHTML !== next) node.innerHTML = next
  }, [value])

  const emit = () => {
    const node = editor.current
    if (!node) return
    const html = sanitizeHtml(node.innerHTML)
    onChange(plainText(html) === '' ? null : html)
  }

  /** `execCommand` is deprecated but still the only thing every browser agrees on. */
  const run = (command: string, argument?: string) => {
    editor.current?.focus()
    document.execCommand(command, false, argument)
    emit()
  }

  const setBlockFormat = (tag: string) => {
    setBlock(tag)
    run('formatBlock', tag.toUpperCase())
  }

  const addLink = () => {
    const url = window.prompt('Link address')
    if (!url) return
    run('createLink', url)
  }

  const empty = plainText(value) === ''

  return (
    <div
      className={cn(
        'rounded-control border-border bg-surface overflow-hidden border',
        'focus-within:border-primary focus-within:ring-ring/30 focus-within:ring-2',
        className,
      )}
    >
      <div className="border-border bg-surface-muted flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        <ToolButton label={t('Undo')} onClick={() => run('undo')}>
          <Undo2 />
        </ToolButton>
        <ToolButton label={t('Redo')} onClick={() => run('redo')}>
          <Redo2 />
        </ToolButton>
        <Divider />
        <ToolButton label={t('Bold')} onClick={() => run('bold')}>
          <Bold />
        </ToolButton>
        <ToolButton label={t('Italic')} onClick={() => run('italic')}>
          <Italic />
        </ToolButton>
        <ToolButton label={t('Underline')} onClick={() => run('underline')}>
          <Underline />
        </ToolButton>
        <ToolButton label={t('Strikethrough')} onClick={() => run('strikeThrough')}>
          <Strikethrough />
        </ToolButton>
        <Divider />
        <Select
          aria-label={t('Text style')}
          className="h-7 w-32 text-xs"
          value={block}
          onChange={setBlockFormat}
          options={[...BLOCKS]}
        />
        <Divider />
        <ToolButton label={t('Bulleted list')} onClick={() => run('insertUnorderedList')}>
          <List />
        </ToolButton>
        <ToolButton label={t('Numbered list')} onClick={() => run('insertOrderedList')}>
          <ListOrdered />
        </ToolButton>
        <ToolButton label={t('Link')} onClick={addLink}>
          <Link2 />
        </ToolButton>
        <Divider />
        <ToolButton label={t('Align left')} onClick={() => run('justifyLeft')}>
          <AlignLeft />
        </ToolButton>
        <ToolButton label={t('Align centre')} onClick={() => run('justifyCenter')}>
          <AlignCenter />
        </ToolButton>
        <ToolButton label={t('Align right')} onClick={() => run('justifyRight')}>
          <AlignRight />
        </ToolButton>
      </div>

      <div className="relative">
        {empty ? (
          <span className="text-fg-subtle pointer-events-none absolute top-2.5 left-3 text-sm">
            {placeholder}
          </span>
        ) : null}
        <div
          id={id}
          ref={editor}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          // Pasting from Word or a web page is how markup gets in; it arrives as
          // plain text and is formatted here instead.
          onPaste={(event) => {
            event.preventDefault()
            const text = event.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, text)
          }}
          className="prose-sm text-fg min-h-28 px-3 py-2.5 text-sm outline-none [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Keeps the selection: the editor must not lose focus before the command runs.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="text-fg-muted hover:bg-surface hover:text-fg rounded-control grid size-7 place-items-center [&_svg]:size-3.5"
    >
      {children}
    </button>
  )
}

const Divider = () => <span className="bg-border mx-1 h-4 w-px" />
