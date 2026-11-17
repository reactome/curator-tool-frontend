import { Pipe, PipeTransform } from '@angular/core';
import { renderMarkdown } from './markdown';

/**
 * Renders a language model's markdown as HTML: `<div class="markdown-body" [innerHTML]="text | markdown"></div>`.
 * Pure, so it renders again only when the text changes, e.g. on each piece of a streamed reply. Safe for model
 * output: renderMarkdown escapes the text before adding any markup, and [innerHTML] still sanitizes the result.
 * Standalone, so NgModules and standalone components can both import it.
 */
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    return renderMarkdown(text);
  }
}
