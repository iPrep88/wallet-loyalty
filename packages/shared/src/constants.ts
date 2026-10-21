/**
 * Apple's strip image height depends on the pass type AND on whether the pass
 * carries a square barcode. Our cards carry a QR code, which is square, so the
 * short variant is the one that applies — a grid designed for the taller strip
 * gets cropped or letterboxed on a real device.
 *
 * Treat these as provisional until a pass has been seen on a physical iPhone;
 * that is the only authority. The renderer takes explicit dimensions so
 * correcting this is a one-line change here, not a redesign.
 */
export const APPLE_STRIP = { width: 375, height: 98 } as const

/** Google Wallet hero images are a wide 3:1 banner, not Apple's strip. */
export const GOOGLE_HERO = { width: 1032, height: 336 } as const

/** Apple needs @1x/@2x/@3x for every image in the bundle. */
export const APPLE_SCALES = [1, 2, 3] as const

export const APPLE_LOGO = { width: 160, height: 50 } as const
export const APPLE_ICON = { width: 29, height: 29 } as const

/** Offered in onboarding. 'custom' means the owner uploaded their own. */
export const STAMP_ICONS = ['cup', 'boba', 'bean', 'star', 'heart', 'circle'] as const

export const STAMPS_REQUIRED_OPTIONS = [8, 10, 12] as const

export const DEFAULTS = {
  joinBonus: 1,
  cooldownSeconds: 120,
  stampsRequired: 10,
  rewardText: 'Free drink',
  backTerms: 'One stamp per purchase. Rewards have no cash value.',
  timezone: 'America/Toronto',
} as const

/** Undo stays open for this long after a stamp, and only for the same staff. */
export const UNDO_WINDOW_SECONDS = 30

/** Most a single scan may add, per the scanner's quantity stepper. */
export const MAX_STAMP_QUANTITY = 10

/** Wrong-PIN tolerance per scanner device before a timed lockout. */
export const PIN_MAX_ATTEMPTS = 5
export const PIN_LOCKOUT_SECONDS = 300

export const BROADCASTS_PER_MONTH = { basic: 4, pro: 30 } as const
