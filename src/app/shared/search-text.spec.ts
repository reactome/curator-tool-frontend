import { containsSearchText, normalizeSearchText } from './search-text';

describe('containsSearchText', () => {
  it('matches a typed hyphen against the dash variants found in display names', () => {
    // Real reaction names: U+2011 (non-breaking hyphen), U+2013 (en dash), U+2010 (hyphen).
    expect(containsSearchText('Cleavage of Procaspase‑9 to caspase‑9', 'procaspase-9')).toBeTrue();
    expect(containsSearchText('engages Fc of the B-cell–bound Rituximab', 'B-cell-bound')).toBeTrue();
    expect(containsSearchText('GSDMD forms ring‐shaped oligomers ', 'ring-shaped')).toBeTrue();
    expect(containsSearchText('Angiotensin−(1-10)', 'angiotensin-(1-10)')).toBeTrue();
  });

  it('matches a pasted name with a special dash against a plain hyphen', () => {
    expect(containsSearchText('Cleavage of Procaspase-9', 'Procaspase‑9')).toBeTrue();
  });

  it('ignores doubled, non-breaking and zero-width spacing', () => {
    expect(containsSearchText('binds pro-caspase 8  ', 'binds pro-caspase 8')).toBeTrue();
    expect(containsSearchText('Receptor CCR9  binds CCL25 ligand', 'CCR9 binds')).toBeTrue();
    expect(containsSearchText('Tie2 bound Grb2', 'bound Grb2')).toBeTrue();
    expect(containsSearchText('p​-STAT5', 'p-STAT5')).toBeTrue();
  });

  it('treats regex and punctuation characters literally', () => {
    const name = 'Secreted ACE:Zn2+ hydrolyzes AGT(25-34) (Angiotensin-(1-10)) to AGT(25-32)';
    expect(containsSearchText(name, 'ACE:Zn2+ hydrolyzes AGT(25-34)')).toBeTrue();
    expect(containsSearchText('2x(KIF5B:ADP):Pi', '2x(KIF5B:ADP)')).toBeTrue();
    expect(containsSearchText('MSN,EZR:F-actin', 'MSN,EZR')).toBeTrue();
    expect(containsSearchText('a.b', 'a*b')).toBeFalse();
    expect(containsSearchText('axb', 'a.b')).toBeFalse();
  });

  it('ignores case and still rejects a real mismatch', () => {
    expect(containsSearchText('ITAM-coupled FCGR3A', 'itam-COUPLED')).toBeTrue();
    expect(containsSearchText('ITAM-coupled FCGR3A', 'ITAM coupled')).toBeFalse();
    expect(containsSearchText(undefined, 'x')).toBeFalse();
  });

  it('folds text to lower case, plain hyphens and single spaces', () => {
    expect(normalizeSearchText('A–B   C')).toBe('a-b c');
  });
});
