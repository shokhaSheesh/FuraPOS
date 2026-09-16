/**
 * The fleet app's own palette, taken from its design — **not** this back
 * office's tokens.
 *
 * It is a different product with a different look (iOS-style pastels on an
 * off-white screen), so the mock pins its colours here rather than reading
 * `tokens.css`, and it stays light whichever theme the back office is in. One
 * file so a colour is still changed in one place; nothing outside
 * `features/mobileApp` may import it.
 */

export const M = {
  screen: '#F5F6F8',
  card: '#FFFFFF',
  border: '#ECEEF2',
  divider: '#F1F3F6',
  text: '#0F172A',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  frame: '#E3E6EB',
  /** The app's call-to-action yellow, which carries black text. */
  cta: '#F5E14B',
} as const

export type MobileTone = 'green' | 'blue' | 'orange' | 'yellow' | 'red' | 'purple' | 'grey'

/** Icon colour and the tint behind it, per accent. */
export const TONES: Record<MobileTone, { fg: string; soft: string }> = {
  green: { fg: '#22C55E', soft: '#E9F9EF' },
  blue: { fg: '#2F6BFF', soft: '#EAF1FF' },
  orange: { fg: '#FF9500', soft: '#FFF3E3' },
  yellow: { fg: '#F5A524', soft: '#FEF6E0' },
  red: { fg: '#FF3B30', soft: '#FFECEA' },
  purple: { fg: '#8B5CF6', soft: '#F1ECFE' },
  grey: { fg: '#8E8E93', soft: '#F2F2F7' },
} as const
