/**
 * Text matching for searches that run in the browser (e.g. over staged instances).
 *
 * Display names are not always typed on a plain keyboard: many reaction names contain a
 * non-breaking hyphen (U+2011), an en dash or a minus sign where a curator would type '-',
 * and some contain doubled or non-breaking spaces. A plain includes() misses all of those,
 * so "Procaspase-9" would not find "Cleavage of Procaspase‑9 to caspase‑9". Both the value
 * and the search term are folded to the same form before comparing, and the term is never
 * treated as a pattern, so every other character ('(', '+', ':', '*', ...) matches literally.
 */

// Hyphen, non-breaking hyphen, figure dash, en/em dashes, horizontal bar, minus sign,
// small and full-width hyphen-minus.
const DASHES = /[‐-―−﹘﹣－]/g;
// Zero-width characters are invisible in a name, so they should not break a match.
const ZERO_WIDTH = /[​-‍⁠﻿]/g;
// \s already covers non-breaking and other Unicode spaces.
const WHITESPACE = /\s+/g;

/** Fold text to the form used for comparison: lower case, plain '-', single spaces. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(DASHES, '-')
    .replace(WHITESPACE, ' ')
    .toLowerCase();
}

/** Whether value contains term, ignoring case, dash variants and spacing differences. */
export function containsSearchText(value: string | null | undefined, term: string): boolean {
  if (value == null)
    return false;
  return normalizeSearchText(value).includes(normalizeSearchText(term));
}
