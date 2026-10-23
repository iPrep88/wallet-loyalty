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

/**
 * How the deal is said out loud.
 *
 * Two shapes, because they are the two a customer already understands:
 *
 *   "Buy 9, get the 10th free" — the card has ten boxes and the last one is
 *   the prize, exactly like the paper card in their wallet now.
 *
 *   "Collect 10 stamps" — ten boxes, all identical, reward after the tenth.
 *
 * Both take the same number of visits. Only the counting changes, and only
 * one number is ever stored: `stamps_required`, the visits it takes.
 */
export function dealLine(stampsRequired: number, rewardInGrid: boolean): string {
  return rewardInGrid
    ? `Buy ${stampsRequired}, get the ${ordinal(stampsRequired + 1)} free`
    : `Collect ${stampsRequired} stamps`
}

/** The same deal said as a qualifier, to sit under the reward itself:
 *  "Free drink" / "on your 10th visit". */
export function dealQualifier(stampsRequired: number, rewardInGrid: boolean): string {
  return rewardInGrid
    ? `on your ${ordinal(stampsRequired + 1)} visit`
    : `after ${stampsRequired} stamps`
}

/** Boxes drawn on the card, which is one more than the visits when the last
 *  box holds the prize. */
export function cardBoxes(stampsRequired: number, rewardInGrid: boolean): number {
  return stampsRequired + (rewardInGrid ? 1 : 0)
}

export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}
