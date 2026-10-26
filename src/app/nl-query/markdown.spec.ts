import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('returns nothing for an empty answer', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
  });

  it('splits paragraphs on blank lines and keeps single newlines as breaks', () => {
    expect(renderMarkdown('One\ntwo\n\nThree')).toBe('<p>One<br>two</p><p>Three</p>');
  });

  it('renders headings', () => {
    expect(renderMarkdown('## Summary')).toBe('<h2>Summary</h2>');
  });

  it('renders emphasis, strikethrough and inline code', () => {
    expect(renderMarkdown('**bold** *it* _it_ ~~gone~~ `a*b*c`'))
      .toBe('<p><strong>bold</strong> <em>it</em> <em>it</em> <del>gone</del> <code>a*b*c</code></p>');
  });

  it('leaves underscores inside identifiers alone', () => {
    expect(renderMarkdown('has_catalyst and some_other_attr')).toBe('<p>has_catalyst and some_other_attr</p>');
  });

  it('renders bulleted and numbered lists, nested by indentation', () => {
    expect(renderMarkdown('- a\n  - b\n- c')).toBe('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(renderMarkdown('3. c')).toBe('<ol start="3"><li>c</li></ol>');
  });

  it('keeps a list together across blank lines between items', () => {
    expect(renderMarkdown('- a\n\n- b\n\nAfter')).toBe('<ul><li>a</li><li>b</li></ul><p>After</p>');
  });

  it('renders a list that follows a paragraph line directly', () => {
    expect(renderMarkdown('Found:\n- a')).toBe('<p>Found:</p><ul><li>a</li></ul>');
  });

  it('renders tables with alignment', () => {
    expect(renderMarkdown('| Name | Count |\n|:---|---:|\n| R1 | 2 |'))
      .toBe('<table><thead><tr><th align="left">Name</th><th align="right">Count</th></tr></thead>'
        + '<tbody><tr><td align="left">R1</td><td align="right">2</td></tr></tbody></table>');
  });

  it('renders fenced code without interpreting markup inside it', () => {
    expect(renderMarkdown('```cypher\nMATCH (n) RETURN n.*x*\n```'))
      .toBe('<pre><code class="language-cypher">MATCH (n) RETURN n.*x*</code></pre>');
  });

  it('renders block quotes and rules', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>');
    expect(renderMarkdown('---')).toBe('<hr>');
  });

  it('links http(s) URLs only', () => {
    expect(renderMarkdown('[Reactome](https://reactome.org)'))
      .toBe('<p><a href="https://reactome.org" target="_blank" rel="noopener noreferrer">Reactome</a></p>');
    expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
  });

  it('escapes HTML in the answer', () => {
    expect(renderMarkdown('<img src=x onerror="alert(1)"> & more'))
      .toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more</p>');
  });
});
