/**
 * The product's name, in one place.
 *
 * A working title: it is on the landing page, on every customer's card and in
 * every browser tab, and it will change. Importing it costs nothing and means
 * the next rename is this line rather than a hunt through markup.
 *
 * The package names (@wl/*) and the repository keep their original name on
 * purpose — renaming those moves every import in the codebase to no benefit
 * a customer ever sees.
 */
export const PRODUCT_NAME = 'Vizis'

/** The line on the back of a customer's card. Their brand first, ours last. */
export const POWERED_BY = `Loyalty by ${PRODUCT_NAME}`
