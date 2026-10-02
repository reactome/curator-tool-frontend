import { ChatEvent } from '../models/llm-api.models';

/**
 * Incremental parser for a server-sent-events stream (event:/data: lines, events separated by a blank
 * line). Network chunks end anywhere, so callers keep the returned `rest` and prepend it to the next
 * chunk. EventSource is not usable here: it cannot send the Authorization header, so the chat is read
 * with fetch and parsed by hand.
 */
export function parseSse(buffer: string): { events: ChatEvent[]; rest: string } {
  const events: ChatEvent[] = [];
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';              // the last block may be incomplete
  for (const block of blocks) {
    let name = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;       // comment / keep-alive
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) continue;
    try {
      events.push({ event: name, data: JSON.parse(data.join('\n')) } as ChatEvent);
    } catch {
      // a malformed event is dropped rather than breaking the whole conversation
    }
  }
  return { events, rest };
}
