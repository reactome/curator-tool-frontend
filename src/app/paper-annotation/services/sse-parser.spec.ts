import { parseSse } from './sse-parser';

describe('parseSse', () => {
  it('parses complete events and keeps an unfinished one for the next chunk', () => {
    const first = parseSse('event: text\ndata: {"delta":"Hel"}\n\nevent: text\ndata: {"delta":"lo"}\n\nevent: do');
    expect(first.events).toEqual([
      { event: 'text', data: { delta: 'Hel' } }, { event: 'text', data: { delta: 'lo' } }] as any);
    const second = parseSse(first.rest + 'ne\ndata: {"proposalIds":["p-001"]}\n\n');
    expect(second.events).toEqual([{ event: 'done', data: { proposalIds: ['p-001'] } }] as any);
    expect(second.rest).toBe('');
  });

  it('handles CRLF line endings, comments, a missing space after the colon and multi-line data', () => {
    const r = parseSse(': keep-alive\r\nevent:text\r\ndata:{"delta":"a"}\r\n\r\nevent: error\r\ndata: {"message":\r\ndata: "boom"}\r\n\r\n');
    expect(r.events).toEqual([{ event: 'text', data: { delta: 'a' } }, { event: 'error', data: { message: 'boom' } }] as any);
  });

  it('drops a malformed event without losing the ones around it', () => {
    const r = parseSse('event: text\ndata: {"delta":"a"}\n\nevent: text\ndata: {not json\n\nevent: text\ndata: {"delta":"b"}\n\n');
    expect(r.events.map(e => (e.data as any).delta)).toEqual(['a', 'b']);
  });

  it('returns nothing for an empty or event-less buffer', () => {
    expect(parseSse('').events).toEqual([]);
    expect(parseSse('event: text\n\n').events).toEqual([]);
  });
});
