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
