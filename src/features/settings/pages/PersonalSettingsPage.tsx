import { useState } from 'react'
import { Save } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { Field } from '@/shared/components/Field'
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Tabs } from '@/shared/ui/Tabs'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { Avatar } from '@/features/employees/components/Avatar'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_GROUPS,
  countInGroup,
  isSubscribed,
} from '../model/settings'

/**
 * Personal data.
 *
 * Two things: who you are, and what you want to be told about.
 */
export default function PersonalSettingsPage() {
  const { user } = useSession()
  const preferences = useDataStore((s) => s.notifications)
  const toggle = useDataStore((s) => s.toggleNotification)
  const employees = useDataStore((s) => s.employees)

  const me = employees.find((employee) => employee.id === user?.id)
  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: me?.phone ?? '',
  })

  const totalOn = NOTIFICATION_EVENTS.filter(
    (event) => (preferences[event.key]?.length ?? 0) > 0,
  ).length

  return (
    <>
      <PageHeader
        title="Personal data"
        description="Your own details, and what the system tells you about."
      />

      <Tabs
        items={[
          {
            value: 'profile',
            label: 'Profile',
            content: (
              <Card>
                <CardHeader className="flex items-center gap-3">
                  <Avatar name={profile.name} src={user?.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <CardTitle>{profile.name}</CardTitle>
                    <p className="text-fg-subtle text-2xs">
                      {user?.role.name} · {me?.locationName ?? 'All locations'}
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      {(p) => (
                        <Input
                          {...p}
                          value={profile.name}
                          onChange={(e) => setProfile((c) => ({ ...c, name: e.target.value }))}
                        />
                      )}
                    </Field>
                    <Field label="Phone">
                      {(p) => (
                        <Input
                          {...p}
                          value={profile.phone}
                          onChange={(e) => setProfile((c) => ({ ...c, phone: e.target.value }))}
                        />
                      )}
                    </Field>
                    <Field label="Email">
                      {(p) => (
                        <Input
                          {...p}
                          value={profile.email}
                          onChange={(e) => setProfile((c) => ({ ...c, email: e.target.value }))}
                        />
                      )}
                    </Field>
                    <Field label="Role" hint="Changed in Access & roles, not here">
                      {(p) => <Input {...p} value={user?.role.name ?? ''} disabled />}
                    </Field>
                  </div>
                  <Button variant="primary" onClick={() => toast.success('Saved')}>
                    <Save />
                    Save changes
                  </Button>
                </CardBody>
              </Card>
            ),
          },
          {
            value: 'notifications',
            label: 'Notifications',
            badge: totalOn,
            content: (
              <Card>
                <CardHeader className="flex-col items-stretch gap-1">
                  <CardTitle>What you want to be told about</CardTitle>
                  {/* The shape CLAUDE.md asks for and the reason for it: a
                      person wants low stock by Telegram and price changes by
                      email, which one master switch cannot express. */}
                  <p className="text-fg-subtle text-2xs">
                    Set per event, per channel — not per screen. You might want low stock by
                    Telegram and an overdue payment by email, and those are different decisions.
                  </p>
                </CardHeader>
                <CardBody className="space-y-5">
                  {NOTIFICATION_GROUPS.map((group) => (
                    <div key={group} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-fg text-sm font-medium">{group}</p>
                        <Badge tone="neutral">
                          {formatNumber(countInGroup(preferences, group))} on
                        </Badge>
                      </div>

                      <div className="border-border rounded-card overflow-x-auto border">
                        <table className="w-full text-sm">
                          <thead className="bg-canvas">
                            <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                              <th className="px-3 py-2 text-left font-semibold">Event</th>
                              {NOTIFICATION_CHANNELS.map((channel) => (
                                <th
                                  key={channel.value}
                                  className="w-24 px-3 py-2 text-center font-semibold"
                                >
                                  {channel.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {NOTIFICATION_EVENTS.filter((event) => event.group === group).map(
                              (event) => (
                                <tr key={event.key} className="border-border border-t">
                                  <td className="px-3 py-2">
                                    <p className="text-fg">{event.label}</p>
                                    <p className="text-fg-subtle text-2xs">{event.hint}</p>
                                  </td>
                                  {NOTIFICATION_CHANNELS.map((channel) => (
                                    <td key={channel.value} className="px-3 py-2 text-center">
                                      <span className="inline-flex">
                                        <Checkbox
                                          aria-label={`${event.label} by ${channel.label}`}
                                          checked={isSubscribed(
                                            preferences,
                                            event.key,
                                            channel.value,
                                          )}
                                          onCheckedChange={() => toggle(event.key, channel.value)}
                                        />
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ),
          },
        ]}
      />
    </>
  )
}
