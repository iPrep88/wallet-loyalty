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
/**
 * Offered at setup. Ordered so a shop finds itself near the front: the plain
 * circle first because it suits anyone and looks the most considered, then the
 * trades this is actually sold to.
 */
export const STAMP_ICONS = [
  'circle', 'boba', 'cup', 'bean', 'bowl', 'croissant', 'scoop', 'star', 'heart',
] as const

/** What to call each one to someone who has never thought about it. */
export const STAMP_ICON_LABELS: Record<(typeof STAMP_ICONS)[number], string> = {
  circle:    'Dot',
  boba:      'Boba cup',
  cup:       'Cup',
  bean:      'Coffee bean',
  bowl:      'Ramen',
  croissant: 'Croissant',
  scoop:     'Ice cream',
  star:      'Star',
  heart:     'Heart',
}

/**
 * Suggested in setup, but owners pick any number in this range: a $4 coffee
 * and a $7 boba want different cards, and a shorter card brings people back
 * sooner.
 */
export const STAMPS_REQUIRED_SUGGESTED = [5, 8, 10, 12] as const
export const STAMPS_REQUIRED_MIN = 3
export const STAMPS_REQUIRED_MAX = 20

/**
 * The four card looks. One renderer, four treatments — an owner picks one and
 * never sees a colour picker unless they go looking for it.
 */
export const CARD_STYLES = [
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'Your logo and colours, nothing else. Needs no photo and usually looks the most expensive.',
    needsPhoto: false,
  },
  {
    id: 'photo',
    name: 'Photo',
    blurb: 'One picture of your shop or your product. We crop and shade it so your card still reads.',
    needsPhoto: true,
  },
  {
    id: 'ai',
    name: 'Signature',
    blurb: 'Artwork generated from your brand. Coming soon.',
    needsPhoto: false,
    comingSoon: true,
  },
] as const

export type CardStyleId = (typeof CARD_STYLES)[number]['id']

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


/**
 * Ready-made cards, for the owner who does not want to design anything.
 *
 * Each is a finished combination rather than a colour to start from — picking
 * any of them produces a card that looks deliberate, which matters more than
 * choice. An owner who makes an ugly card puts the QR stand in a drawer.
 */
export const CARD_TEMPLATES = [
  { id: 'ink',       name: 'Ink',       bg: '#14181F', fg: '#F2F4F7', label: '#8E97A3' },
  { id: 'porcelain', name: 'Porcelain', bg: '#F7F6F3', fg: '#1C1E22', label: '#6B6F76' },
  { id: 'pine',      name: 'Pine',      bg: '#14342B', fg: '#E8F1EC', label: '#8FAFA0' },
  { id: 'harbour',   name: 'Harbour',   bg: '#15293D', fg: '#E6EEF6', label: '#8FA6BC' },
  { id: 'plum',      name: 'Plum',      bg: '#2A1A2E', fg: '#F3E8F5', label: '#A992AE' },
  { id: 'ember',     name: 'Ember',     bg: '#2E1A14', fg: '#F7EAE3', label: '#BC9B8D' },
] as const

export type CardTemplateId = (typeof CARD_TEMPLATES)[number]['id']
