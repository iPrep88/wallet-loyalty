/**
 * Reward wording and value.
 *
 * A wallet card gives the reward a narrow field, and long text is cut off
 * mid-word on the customer's phone. So the presets are deliberately blunt, and
 * anything custom is length-checked here rather than discovered truncated.
 */
export const REWARD_MAX_LENGTH = 24

/** What most shops want, in the words they would use. */
export const REWARD_PRESETS = [
  'Free drink',
  'Free boba',
  'Free coffee',
  'Free topping',
  'Free size upgrade',
  'Free pastry',
  '50% off next order',
  'Free scoop',
] as const

export function isValidRewardText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= REWARD_MAX_LENGTH
}

/** Dollars in, cents stored. Returns null for blank, which is allowed. */
export function parseRewardValue(input: string): number | null | 'invalid' {
  const trimmed = input.trim().replace(/^\$/, '')
  if (trimmed === '') return null
  const dollars = Number(trimmed)
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 1000) return 'invalid'
  return Math.round(dollars * 100)
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** "$427" — for a dashboard figure, where the pennies are noise. */
export function formatCentsRounded(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-CA')}`
}
