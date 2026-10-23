/**
 * The product's name, in one place.
 *
 * Settled, as of the day tryrepio.com went live. It is on the landing page,
 * on every customer's card and in every browser tab, and keeping it here
 * costs nothing and means a rename is this line rather than a hunt through
 * markup.
 *
 * The package names (@wl/*) and the repository keep their original name on
 * purpose — renaming those moves every import in the codebase to no benefit
 * a customer ever sees.
 */
export const PRODUCT_NAME = 'Repio'

/** The line on the back of a customer's card. Their brand first, ours last. */
export const POWERED_BY = `Loyalty by ${PRODUCT_NAME}`
