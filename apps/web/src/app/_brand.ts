/**
 * The marketing page's palette, written out rather than taken from the app's
 * semantic tokens.
 *
 * Those tokens flip with the viewer's system theme, which is right for a tool
 * someone works in all day and wrong for a sales page: this one should look
 * the same to everybody, because it is a single designed thing rather than a
 * surface that adapts.
 */
export { PRODUCT_NAME } from '../lib/product'

export const BRAND = {
  midnight:   '#061525',
  deepNavy:   '#0A2035',
  navy:       '#12324D',
  iceBlue:    '#8BC8FF',
  brightBlue: '#5AAEFF',
  paleIce:    '#E8F4FF',
  snow:       '#F8FAFC',
  white:      '#FFFFFF',
  ink:        '#0B1B2B',
  slate:      '#667789',
  border:     '#DFE6EC',
} as const

/**
 * Numbers and quotes that are not true yet.
 *
 * Every value here is invented. They are kept in one place, named like this,
 * so that nobody can ship them by accident — a made-up testimonial from a
 * made-up café owner is the kind of thing a shop owner checks, and the product
 * does not need it.
 *
 * Replace with real figures once there are some, or delete the sections.
 */
export const UNVERIFIED = {
  businesses: '1,500+',
  visits: '3.2M+',
  repeatLift: '40%',
  testimonial: {
    quote:
      'VIZIS has completely changed how we think about customer retention. '
      + "It's simple, elegant, and our customers love it.",
    name: 'Sarah K.',
    role: 'Owner, Maison Coffee & Patisserie',
  },
  repeatRate: '+45%',
  visitsPerCustomer: '2.8x',
} as const
