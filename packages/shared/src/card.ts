/** What the card shows right now. Derived, never stored. */
export type CardState = 'collecting' | 'reward_ready'

export function cardState(stamps: number, stampsRequired: number): CardState {
  return stamps >= stampsRequired ? 'reward_ready' : 'collecting'
}

/**
 * The lock-screen line a customer sees when their card updates.
 * Apple only shows this when the field's value actually CHANGES — two
 * identical messages in a row produce no notification at all.
 */
export function stampChangeMessage(
  stamps: number,
  stampsRequired: number,
  rewardText: string,
): string {
  if (stamps >= stampsRequired) return `Reward ready — ${rewardText}!`
  const remaining = stampsRequired - stamps
  return `${stamps}/${stampsRequired} — ${remaining} more for ${rewardText.toLowerCase()}`
}

/** Header fields sit next to the logo and are narrow. Keep this short. */
export function headerValue(stamps: number, stampsRequired: number): string {
  // "REWARD READY" truncates in the header field; "READY" does not.
  return stamps >= stampsRequired ? 'READY 🎉' : `${stamps} / ${stampsRequired}`
}
