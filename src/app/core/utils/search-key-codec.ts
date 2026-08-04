/**
 * The advanced search sends its attributes, operands and search keys to the backend as
 * three comma-delimited lists that are zipped back together by position. A search term
 * containing a comma therefore has to be escaped, or it splits into two keys and
 * desynchronizes the lists. This matters most for regular expressions, where a
 * quantifier such as a{2,3} is perfectly ordinary.
 *
 * The escaping here mirrors CuratorToolWSUtils.splitSearchKeys on the backend: a
 * backslash escapes a comma or another backslash, and every other backslash is left
 * alone so that regex escapes such as \d survive untouched.
 */

/**
 * Join search keys into the comma-delimited searchKeys parameter, escaping commas
 * and backslashes in the individual terms.
 */
export function encodeSearchKeys(keys: string[]): string {
  return keys.map(key => key.replace(/\\/g, '\\\\').replace(/,/g, '\\,')).join(',');
}

/**
 * Split a comma-delimited searchKeys parameter back into individual terms, undoing
 * the escaping added by encodeSearchKeys. Used when a search is restored from the
 * URL's query parameters.
 */
export function decodeSearchKeys(text: string): string[] {
  const keys: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === '\\' && i + 1 < text.length) {
      const next = text.charAt(i + 1);
      // Only ',' and '\' are escaped by encodeSearchKeys; any other backslash is part
      // of the term itself (e.g. the \d in a regex) and is kept as-is.
      if (next === ',' || next === '\\') {
        current += next;
        i++;
        continue;
      }
      current += c;
    }
    else if (c === ',') {
      keys.push(current);
      current = '';
    }
    else
      current += c;
  }
  keys.push(current);
  return keys;
}
