import { currentAppUrl, isReturnUrlResumable, saveReturnUrl, takeReturnUrl, toBrowserUrl } from './session-url';

describe('session-url', () => {
  afterEach(() => {
    sessionStorage.removeItem('currentUrl');
    sessionStorage.removeItem('currentUrl_parked_token');
    localStorage.removeItem('token');
  });

  it('falls back to /home when nothing was remembered', () => {
    expect(takeReturnUrl()).toBe('/home');
  });

  it('consumes the remembered view', () => {
    saveReturnUrl('/schema_view/instance/1');
    expect(takeReturnUrl()).toBe('/schema_view/instance/1');
    expect(takeReturnUrl()).toBe('/home');
  });

  it('never remembers /login', () => {
    saveReturnUrl('/login');
    expect(sessionStorage.getItem('currentUrl')).toBeNull();
  });

  it('only resumes against a token other than the one the tab was parked with', () => {
    localStorage.setItem('token', 'dead');
    saveReturnUrl('/event_view');
    expect(isReturnUrlResumable()).toBeFalse();
    localStorage.setItem('token', 'fresh');
    expect(isReturnUrlResumable()).toBeTrue();
  });

  // Production is mounted under /curatortool/. The saved view has to be a router URL (what
  // LoginComponent and loginGuard route to), and a full-page reload has to put the base back,
  // or a tab lands on https://curator.reactome.org/home - outside the app.
  describe('under a non-root base href', () => {
    let base: HTMLBaseElement;

    beforeEach(() => {
      base = document.createElement('base');
      base.href = '/curatortool/';
      document.head.prepend(base);
    });

    afterEach(() => base.remove());

    it('strips the base from a remembered browser URL', () => {
      saveReturnUrl('/curatortool/schema_view/instance/1');
      expect(takeReturnUrl()).toBe('/schema_view/instance/1');
    });

    it('strips the base from a value an older build left in sessionStorage', () => {
      sessionStorage.setItem('currentUrl', '/curatortool/event_view');
      expect(takeReturnUrl()).toBe('/event_view');
    });

    it('leaves router URLs alone', () => {
      saveReturnUrl('/schema_view/instance/1');
      expect(takeReturnUrl()).toBe('/schema_view/instance/1');
    });

    it('treats /curatortool/login as /login', () => {
      saveReturnUrl('/curatortool/login');
      expect(sessionStorage.getItem('currentUrl')).toBeNull();
    });

    it('does not mistake a route that merely starts with the base name for the base', () => {
      saveReturnUrl('/curatortoolbox');
      expect(takeReturnUrl()).toBe('/curatortoolbox');
    });

    it('puts the base back for a full-page navigation', () => {
      expect(toBrowserUrl('/home')).toBe('/curatortool/home');
    });

    it('reports the current view without the base', () => {
      expect(currentAppUrl().startsWith('/curatortool')).toBeFalse();
    });
  });

  it('adds nothing for a full-page navigation without a base element', () => {
    expect(toBrowserUrl('/home')).toBe('/home');
  });
});
