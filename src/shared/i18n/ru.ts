import type { Dictionary } from './t'

/**
 * Russian, keyed by the English source text.
 *
 * A plural takes all three forms — `['товар', 'товара', 'товаров']` — and is
 * keyed by the English plural, because that is what `tn()` looks it up by.
 * Anything missing here falls back to the English key, so the screen stays
 * readable while a module is being translated.
 */
export const ru: Dictionary = {}
