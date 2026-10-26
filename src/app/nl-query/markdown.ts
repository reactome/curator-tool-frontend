/**
 * A small markdown-to-HTML renderer for the graph query answers. It covers what the model writes:
 * headings, paragraphs, bold/italic/strikethrough, inline code, fenced code, bulleted and numbered
 * lists (nested by indentation), block quotes, tables, rules and links.
 *
 * The source is HTML-escaped before any markup is added, so the answer can never inject its own
 * tags; links are only made for http(s) and mailto URLs. The result is still bound through
 * [innerHTML], so Angular's sanitizer has the final say.
 */
export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return '';
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^\s*(```|~~~)\s*([\w-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      i++; // the closing fence
      const lang = fence[2] ? ` class="language-${fence[2]}"` : '';
      out.push(`<pre><code${lang}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      i = table(lines, i, out);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      i = list(lines, i, out);
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(quoted.join('\n'))}</blockquote>`);
      continue;
    }

    // A paragraph runs until a blank line or the start of another block. Single newlines are kept
    // as line breaks, since that is how a chat answer is usually meant to read.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) para.push(lines[i++].trim());
    out.push(`<p>${para.map(inline).join('<br>')}</p>`);
  }

  return out.join('');
}

const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  return /^\s*(```|~~~)/.test(line) || /^\s{0,3}#{1,6}\s/.test(line) || /^\s{0,3}>/.test(line)
    || LIST_ITEM.test(line) || /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)
    || (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1]));
}

/** Render a list starting at lines[start], nesting by indentation; returns the next line to read. */
function list(lines: string[], start: number, out: string[]): number {
  const stack: { tag: 'ul' | 'ol'; indent: number }[] = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const item = line.match(LIST_ITEM);

    if (item) {
      const indent = indentOf(item[1]);
      const tag = /\d/.test(item[2]) ? 'ol' : 'ul';
      while (stack.length && stack[stack.length - 1].indent > indent) {
        out.push(`</li></${stack.pop()!.tag}>`);
      }
      const top = stack[stack.length - 1];
      if (top && top.indent === indent && top.tag === tag) {
        out.push('</li>');
      } else {
        if (top && top.indent === indent) out.push(`</li></${stack.pop()!.tag}>`);
        const first = parseInt(item[2], 10);
        out.push(tag === 'ol' && first !== 1 ? `<ol start="${first}">` : `<${tag}>`);
        stack.push({ tag, indent });
      }
      out.push(`<li>${inline(item[3])}`);
      i++;
    } else if (line.trim() && !startsBlock(lines, i)) {
      // A continuation of the item above.
      out.push(`<br>${inline(line.trim())}`);
      i++;
    } else if (!line.trim()) {
      // A blank line ends the list unless an item or an indented continuation follows.
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (next < lines.length && (LIST_ITEM.test(lines[next]) || /^\s{2,}\S/.test(lines[next]))) i = next;
      else break;
    } else {
      break;
    }
  }

  while (stack.length) out.push(`</li></${stack.pop()!.tag}>`);
  return i;
}

/** Render a table whose header is lines[start]; returns the next line to read. */
function table(lines: string[], start: number, out: string[]): number {
  const header = cells(lines[start]);
  const aligns = cells(lines[start + 1]).map(c => {
    const left = c.startsWith(':'), right = c.endsWith(':');
    return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
  });
  const align = (col: number) => aligns[col] ? ` align="${aligns[col]}"` : '';

  const html = ['<table><thead><tr>'];
  header.forEach((c, col) => html.push(`<th${align(col)}>${inline(c)}</th>`));
  html.push('</tr></thead><tbody>');

  let i = start + 2;
  while (i < lines.length && lines[i].trim() && isTableRow(lines[i])) {
    const row = cells(lines[i++]);
    html.push('<tr>');
    header.forEach((_, col) => html.push(`<td${align(col)}>${inline(row[col] ?? '')}</td>`));
    html.push('</tr>');
  }
  html.push('</tbody></table>');
  out.push(html.join(''));
  return i;
}

function isTableRow(line: string): boolean {
  return line.includes('|');
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-');
}

/** The cells of a table row, without the optional outer pipes. Escaped pipes (\|) stay in the cell. */
function cells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

function indentOf(whitespace: string): number {
  return whitespace.replace(/\t/g, '    ').length;
}

/** Inline markup within a single block of text. */
function inline(text: string): string {
  // Code spans are set aside first so nothing inside them is treated as markup.
  const codes: string[] = [];
  let html = escapeHtml(text).replace(/(`+)(.+?)\1/g, (_, __, code: string) => {
    codes.push(`<code>${code.trim()}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  html = html
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g,
      (_, label: string, url: string) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '<strong>$2</strong>')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?![*\w])/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<del>$1</del>');

  return html.replace(/\u0000(\d+)\u0000/g, (_, n: string) => codes[Number(n)]);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
