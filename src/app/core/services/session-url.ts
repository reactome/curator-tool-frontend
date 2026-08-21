/**
 * The view a tab was showing when its session ended, remembered so that re-authenticating
 * lands the curator back where they were instead of on /home.
 *
 * sessionStorage rather than localStorage on purpose: every tab has to remember its *own*
 * view. This app opens instances in new tabs all over the place, so a shared slot would mean
 * whichever tab was torn down last decided where all the others resumed.
 *
 * Every path that sends a tab to /login has to write this - the route guard blocking a
 * navigation, the auth interceptor giving up on a token refresh, a 401 reaching the data
 * layer, the idle logout, and a logout arriving from a sibling tab. Each one used to inline
 * its own copy, and the idle logout simply forgot, which is how a set of tabs left to time out
 * overnight all came back on /home with their views lost. Keeping the reads and the writes in
 * one place is what stops the next caller forgetting too.
 */

/** sessionStorage key holding this tab's post-login destination. */
const RETURN_URL_KEY = 'currentUrl';

/**
 * sessionStorage key holding the token this tab held at the moment it was parked at /login -
 * the one that had stopped working (or nothing, if it had already been cleared). See
 * {@link isReturnUrlResumable} for why knowing that matters.
 */
const PARKED_TOKEN_KEY = 'currentUrl_parked_token';

/**
 * Remember where this tab is before sending it to /login.
 *
 * Pass a router URL when one is at hand (a guard's `state.url`, which exists before the
 * address bar has caught up); otherwise the current address bar is used. /login is never
 * saved - as a destination it is meaningless, and overwriting a real saved view with it would
 * lose exactly what this exists to preserve.
 */
export function saveReturnUrl(url?: string): void {
  const target = url
    ?? window.location.pathname + window.location.search + window.location.hash;
  if (!target || target.startsWith('/login'))
    return;
  sessionStorage.setItem(RETURN_URL_KEY, target);
  const parkedToken = localStorage.getItem('token');
  if (parkedToken)
    sessionStorage.setItem(PARKED_TOKEN_KEY, parkedToken);
  else
    sessionStorage.removeItem(PARKED_TOKEN_KEY);
}

/**
 * Consume the remembered view, falling back to /home when there is none. Consumed rather than
 * merely read so a stale destination cannot hijack a later, unrelated login in this tab.
 */
export function takeReturnUrl(fallback: string = '/home'): string {
  const url = sessionStorage.getItem(RETURN_URL_KEY) ?? fallback;
  sessionStorage.removeItem(RETURN_URL_KEY);
  sessionStorage.removeItem(PARKED_TOKEN_KEY);
  return url;
}

/**
 * Whether this tab can be sent back to its remembered view right now without asking for
 * credentials - i.e. it has one, and the session has since been re-established by *something
 * else* (a sibling tab logging in, most often).
 *
 * The token comparison is the load-bearing part. "There is a token in localStorage" is not
 * enough, because not every teardown clears it: DataService.handleErrorMessage redirects to
 * /login on a 401 while deliberately leaving a locally-still-valid-but-server-rejected token
 * in place. Resuming on the strength of that token would send the tab straight back to the
 * page whose request just 401'd, which would 401 again - a redirect loop between the view and
 * the login page. So a tab may only resume against a token that is demonstrably *not* the one
 * that died on it.
 */
export function isReturnUrlResumable(): boolean {
  if (!sessionStorage.getItem(RETURN_URL_KEY))
    return false;
  const token = localStorage.getItem('token');
  if (!token)
    return false;
  return token !== sessionStorage.getItem(PARKED_TOKEN_KEY);
}
