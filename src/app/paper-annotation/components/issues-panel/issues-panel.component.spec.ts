import { of, throwError } from 'rxjs';
import { Issue } from '../../models/llm-api.models';
import { LlmApiError } from '../../services/llm-api.service';
import { IssuesPanelComponent } from './issues-panel.component';

describe('IssuesPanelComponent', () => {
  const issue = (id: string, severity: Issue['severity'], status: Issue['status'] = 'open', key: string | null = 'r0'): Issue =>
    ({ id, source: 'qa', severity, code: 'c', message: `m-${id}`, reaction_key: key, participant_key: null, instance_db_id: null, status });
  let api: jasmine.SpyObj<any>;
  let panel: IssuesPanelComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj('LlmApiService', ['setIssueStatus']);
    panel = new IssuesPanelComponent(api);
    panel.sessionId = 's1';
    panel.issues = [issue('i3', 'info'), issue('i1', 'action', 'open', 'r1'), issue('i2', 'warning'), issue('i4', 'action', 'dismissed'),
                    issue('i5', 'action', 'open', 'r0')];
  });

  it('shows open issues first by severity (action, warning, info), then by reaction', () => {
    expect(panel.shown.map(i => i.id)).toEqual(['i5', 'i1', 'i2', 'i3']);
  });

  it('filters by status and severity', () => {
    panel.status = 'dismissed';
    expect(panel.shown.map(i => i.id)).toEqual(['i4']);
    panel.status = 'all';
    panel.severity = 'action';
    expect(panel.shown.map(i => i.id)).toEqual(['i4', 'i5', 'i1']);
  });

  it('counts only open issues per severity', () => {
    expect(panel.count('action')).toBe(2);
    expect(panel.count('warning')).toBe(1);
    expect(panel.count('info')).toBe(1);
  });

  it('changes an issue status through the API and reports the updated issue', () => {
    const updated = issue('i1', 'action', 'resolved', 'r1');
    api.setIssueStatus.and.returnValue(of(updated));
    const out: Issue[] = [];
    panel.changed.subscribe(i => out.push(i));
    panel.setStatus(panel.issues[1], 'resolved');
    expect(api.setIssueStatus).toHaveBeenCalledWith('s1', 'i1', 'resolved');
    expect(out).toEqual([updated]);
    expect(panel.busy.has('i1')).toBeFalse();
  });

  it('shows the reason and changes nothing when the update fails', () => {
    api.setIssueStatus.and.returnValue(throwError(() => new LlmApiError(404, 'no such issue')));
    const out: Issue[] = [];
    panel.changed.subscribe(i => out.push(i));
    panel.setStatus(panel.issues[1], 'dismissed');
    expect(panel.error).toBe('no such issue');
    expect(out).toEqual([]);
    expect(panel.busy.size).toBe(0);
  });

  it('picks an icon by severity', () => {
    expect(['action', 'warning', 'info'].map(s => panel.icon(issue('x', s as Issue['severity'])))).toEqual(['error', 'warning', 'info']);
  });
});
