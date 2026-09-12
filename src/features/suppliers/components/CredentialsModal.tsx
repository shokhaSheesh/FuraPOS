import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'

/**
 * The one moment the password exists.
 *
 * Nothing stores it, so this is not a summary of a record — it is the hand-off
 * itself, and the copy—: the whole modal is built around getting it out of here
 * and into a message before it is closed. Everything else about the login can
 * be looked up later; this cannot, which is why the warning is not decoration.
 */
export function CredentialsModal({
  open,
  onOpenChange,
  companyName,
  managerName,
  username,
  password,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyName: string
  managerName: string | null
  username: string
  password: string
}) {
  const [copied, setCopied] = useState<'both' | 'password' | null>(null)

  const copy = (text: string, what: 'both' | 'password') => {
    // Clipboard access can be refused outright, and a button that silently
    // does nothing is worse than one that admits it — so the text stays
    // selectable on screen either way.
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(what)
        setTimeout(() => setCopied(null), 2000)
      })
      .catch(() => setCopied(null))
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Login for ${companyName}`}
      description={
        managerName
          ? `Send these to ${managerName}. The password is shown once and is not stored anywhere.`
          : 'The password is shown once and is not stored anywhere.'
      }
      size="sm"
      footer={
        <footer className="border-border flex items-center justify-between gap-2 border-t p-4">
          <Button
            variant="secondary"
            onClick={() => copy(`Login: ${username}\nPassword: ${password}`, 'both')}
          >
            {copied === 'both' ? <Check /> : <Copy />}
            {copied === 'both' ? 'Copied' : 'Copy both'}
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </footer>
      }
    >
      <div className="space-y-3">
        <div className="border-border rounded-card divide-border divide-y border">
          <Line label="Login" value={username} />
          <Line
            label="Password"
            value={password}
            action={
              <Button
                variant="ghost"
                size="sm"
                aria-label="Copy password"
                onClick={() => copy(password, 'password')}
              >
                {copied === 'password' ? <Check /> : <Copy />}
              </Button>
            }
          />
        </div>

        <p className="text-fg-muted bg-warning-soft rounded-card flex gap-2 p-3 text-sm">
          <KeyRound className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            Once this closes, the password cannot be read again — not here and not by us. If it gets
            lost, issue a new one from the supplier’s page.
          </span>
        </p>
      </div>
    </Modal>
  )
}

function Line({
  label,
  value,
  action,
}: {
  label: string
  value: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <span className="text-fg-muted text-sm">{label}</span>
      <span className="flex items-center gap-1">
        {/* Selectable on purpose: copying by hand has to stay possible. */}
        <code className="text-fg text-sm font-mono select-all">{value}</code>
        {action}
      </span>
    </div>
  )
}
