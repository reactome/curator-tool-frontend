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
 * The path the app is mounted under, without a trailing slash: '' in development (base href
 * '/'), '/curatortool' in production (`npm run build` passes --base-href='/curatortool/').
 */
function basePath(): string {
  // The <base> element itself, as Angular's own PathLocationStrategy reads it, rather than
  // document.baseURI: with no <base> (the Karma runner) the latter is the page's own URL, which
  // would make '/context.html' look like a mount point.
  const baseElement = document.querySelector('base');
  if (!baseElement)
    return '';
  const base = new URL(baseElement.href).pathname;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * Strip the base path from a browser URL, giving the router URL Angular routes on.
 *
 * The saved view is consumed in two different ways: LoginComponent and loginGuard hand it to
 * the router, which only knows URLs relative to the base href, while SessionSyncService reloads
 * the whole page with it via window.location.href, which needs the base href in front. The
 * callers used to save whichever form they had to hand - the guard a router URL, everything
 * else window.location.pathname - and neither consumer was right for both. In production
 * (mounted under /curatortool/) that broke both ways at once after an idle logout:
 *  - the idle logout saved '/curatortool/schema_view/...', the router matched no route for it,
 *    and the curator's first OK on the login form left them sitting on /login (the saved view
 *    already consumed), so only the second OK - falling back to /home - got them in;
 *  - sibling tabs waiting at /login were reloaded to a bare '/home' (or '/schema_view/...'),
 *    i.e. https://curator.reactome.org/home, outside the app, which the server answers with
 *    an error page.
 * So the slot now always holds a router URL, and toBrowserUrl() adds the base back for the one
 * caller that needs it. Applied on read as well as write, because sessionStorage survives a
 * deploy: a tab torn down by an older build may still hold the prefixed form.
 */
function toAppUrl(url: string): string {
  const base = basePath();
  if (base && (url === base || url.startsWith(base + '/')))
    return url.slice(base.length) || '/';
  return url;
}

/** The router URL of what this tab is showing, taken from the address bar. */
export function currentAppUrl(): string {
  return toAppUrl(window.location.pathname) + window.location.search + window.location.hash;
}

/** Prefix a router URL with the base path, for a full-page navigation (window.location). */
export function toBrowserUrl(appUrl: string): string {
  return basePath() + appUrl;
}

/**
 * Remember where this tab is before sending it to /login.
 *
 * Pass a router URL when one is at hand (a guard's `state.url`, which exists before the
 * address bar has caught up); otherwise the current address bar is used, minus the base path
 * (see toAppUrl()). /login is never
 * saved - as a destination it is meaningless, and overwriting a real saved view with it would
 * lose exactly what this exists to preserve.
 */
export function saveReturnUrl(url?: string): void {
  const target = url !== undefined ? toAppUrl(url) : currentAppUrl();
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
  const saved = sessionStorage.getItem(RETURN_URL_KEY);
  const url = saved ? toAppUrl(saved) : fallback;
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
