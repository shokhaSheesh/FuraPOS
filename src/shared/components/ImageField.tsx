import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { toast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/cn'

/**
 * Picks one picture and keeps it as a data URL.
 *
 * There is no backend and no file storage in this build, so the image travels
 * with the record it belongs to — which is fine for a few hundred catalogue
 * photos and is exactly what a real build would replace with an upload. The
 * cap below keeps a 12 MB camera original from being pasted into the store.
 */
const MAX_BYTES = 2 * 1024 * 1024

export function ImageField({
  value,
  onChange,
  id,
  className,
  size = 'md',
}: {
  /** A data URL, or null for no picture. */
  value: string | null
  onChange: (value: string | null) => void
  id?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const input = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)

  const choose = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('That file is not an image')
    if (file.size > MAX_BYTES) return toast.error('Pictures must be under 2 MB')
    setReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      onChange(String(reader.result))
      setReading(false)
    }
    reader.onerror = () => {
      toast.error('That picture could not be read')
      setReading(false)
    }
    reader.readAsDataURL(file)
  }

  const box = size === 'sm' ? 'size-12' : size === 'lg' ? 'size-28' : 'size-20'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          'rounded-control border-border bg-surface-muted text-fg-subtle grid shrink-0 place-items-center overflow-hidden border border-dashed',
          'hover:border-border-strong hover:text-fg-muted',
          box,
        )}
        aria-label={value ? 'Replace the picture' : 'Add a picture'}
      >
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className={size === 'lg' ? 'size-7' : 'size-5'} />
        )}
      </button>

      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={reading}
          onClick={() => input.current?.click()}
        >
          {value ? 'Replace' : 'Upload picture'}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => onChange(null)}
          >
            <Trash2 />
            Remove
          </Button>
        ) : size === 'sm' ? null : (
          <span className="text-fg-subtle text-2xs">JPG or PNG, up to 2 MB</span>
        )}
      </div>

      <input
        id={id}
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          choose(event.target.files?.[0])
          // Lets the same file be picked twice in a row.
          event.target.value = ''
        }}
      />
    </div>
  )
}
