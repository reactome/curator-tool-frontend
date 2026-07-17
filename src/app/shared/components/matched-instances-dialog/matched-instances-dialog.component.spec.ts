import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { Component } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { of, EMPTY } from 'rxjs';
import { concatMap, finalize } from 'rxjs/operators';
import { MatchedInstancesDialogData } from './matched-instances-dialog.component';
import { MatchedInstancesDialogService } from './matched-instances-dialog.service';
import { CommitWaitDialogComponent } from '../commit-wait-dialog/commit-wait-dialog.component';
import { StoreModule } from '@ngrx/store';
import { RouterTestingModule } from '@angular/router/testing';

const EMPTY_ENTITY_STATE = { ids: [], entities: {} };

@Component({ template: '', standalone: true })
class HostComponent {}

describe('MatchedInstancesDialogComponent (via MatDialog.open, real overlay path)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let service: MatchedInstancesDialogService;
  let dialog: MatDialog;

  const testData: MatchedInstancesDialogData = {
    title: 'Matches Found - Not Committed',
    groups: [
      {
        newInstance: { dbId: -1, displayName: 'New Thing', schemaClassName: 'Pathway' },
        matches: [
          { dbId: 100, displayName: 'Existing Thing A', schemaClassName: 'Pathway' },
          { dbId: 101, displayName: 'Existing Thing B', schemaClassName: 'Pathway' }
        ]
      }
    ]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HostComponent,
        MatDialogModule,
        NoopAnimationsModule,
        RouterTestingModule,
        StoreModule.forRoot({} as any, {
          initialState: {
            new_instances: EMPTY_ENTITY_STATE,
            updated_instances: EMPTY_ENTITY_STATE,
            delete_instances: EMPTY_ENTITY_STATE,
          }
        })
      ],
      providers: [MatchedInstancesDialogService, Overlay]
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    service = TestBed.inject(MatchedInstancesDialogService);
    dialog = TestBed.inject(MatDialog);
  });

  it('should attach a table to the actual overlay DOM when opened via MatDialog.open()', fakeAsync(() => {
    service.openDialog(testData);
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    const overlayContainer: HTMLElement = document.querySelector('.cdk-overlay-container') as HTMLElement;
    console.log('Overlay container found:', !!overlayContainer);
    console.log('Overlay container HTML:\n', overlayContainer?.innerHTML);

    const tables = overlayContainer?.querySelectorAll('table') ?? [];
    console.log('Tables found in overlay:', tables.length);

    const dialogContainer = overlayContainer?.querySelector('mat-dialog-container, .mat-mdc-dialog-container');
    console.log('Dialog container found:', !!dialogContainer);
    if (dialogContainer) {
      const rect = (dialogContainer as HTMLElement).getBoundingClientRect();
      console.log('Dialog container rect:', JSON.stringify(rect));
    }

    tables.forEach((t, i) => {
      const rect = (t as HTMLElement).getBoundingClientRect();
      console.log(`Table ${i} rect:`, JSON.stringify(rect), 'offsetParent:', !!(t as HTMLElement).offsetParent);
    });

    expect(tables.length).toBeGreaterThan(0);

    dialog.closeAll();
    flush();
  }));

  it('routes a launch action-button click through to window.open, and the button is hit-testable', fakeAsync(() => {
    const openSpy = spyOn(window, 'open').and.returnValue({} as Window);

    service.openDialog(testData);
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    const overlayContainer: HTMLElement = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const buttons = Array.from(overlayContainer?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
    const launchButton = buttons.find(b => (b.textContent || '').trim().includes('launch'));
    expect(launchButton).toBeTruthy();

    // Guard against the positioning regression: the action cell must not be absolutely
    // positioned (which pulls the button out of its cell), and a point hit-test at the
    // button's centre must resolve to the button itself (nothing overlapping it).
    const actionCell = launchButton!.closest('td') as HTMLElement;
    expect(getComputedStyle(actionCell).position).toBe('static');
    const btnRect = launchButton!.getBoundingClientRect();
    const hit = document.elementFromPoint(
      btnRect.left + btnRect.width / 2,
      btnRect.top + btnRect.height / 2
    ) as HTMLElement;
    expect(launchButton!.contains(hit)).toBe(true);

    // Wiring: click -> table.actionEvent -> handleAction -> openInstance -> window.open
    launchButton!.click();
    fixture.detectChanges();
    flush();
    expect(openSpy).toHaveBeenCalledWith('schema_view/instance/100', '_blank');

    dialog.closeAll();
    flush();
  }));

  it('keeps the matches table DOM stable across change detection (so real mouse clicks are not lost)', fakeAsync(() => {
    const ref = service.openDialog(testData);
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    const component = ref.componentInstance;
    const group = component.groups[0];

    // Root cause guard: the [dataSource] binding must return a STABLE reference.
    // If getMatchedRows() re-normalizes, it yields a new array of new row objects
    // every call, the mat-table re-renders all rows each change-detection cycle,
    // and the action buttons are destroyed/recreated mid-click (mousedown then
    // mouseup on different element instances => no click => launch silently lost).
    expect(component.getMatchedRows(group)).toBe(component.getMatchedRows(group));

    const overlayContainer: HTMLElement = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const launchBefore = Array.from(overlayContainer.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim().includes('launch')) as HTMLButtonElement;
    expect(launchBefore).toBeTruthy();

    // Force several change-detection cycles like real pointer interaction would.
    fixture.detectChanges();
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    const launchAfter = Array.from(overlayContainer.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim().includes('launch')) as HTMLButtonElement;

    // Same element instance still in the DOM => a mousedown/mouseup pair lands on
    // one button and the click actually fires.
    expect(launchAfter).toBe(launchBefore);
    expect(launchBefore.isConnected).toBe(true);

    dialog.closeAll();
    flush();
  }));

  it('should still show the table when replicating the real commitInstance() stacked-dialog flow', fakeAsync(() => {
    // Replicate local-instance-list.component.ts commitInstance(): open a wait dialog first
    // (disableClose, hasBackdrop), then run matchInstances().pipe(concatMap(...), finalize(() => close wait dialog))
    const commitWaitDialogRef = dialog.open(CommitWaitDialogComponent, {
      disableClose: true,
      hasBackdrop: true,
      autoFocus: false,
      restoreFocus: false,
      data: { title: 'Committing New Instance', message: 'Please wait...' }
    });
    fixture.detectChanges();

    const matches = testData.groups[0].matches;
    const instance = testData.groups[0].newInstance;

    of(matches).pipe(
      concatMap(m => {
        if (m && m.length > 0) {
          service.openDialog({
            title: 'Matches Found - Not Committed',
            groups: [{ newInstance: instance, matches: m }]
          });
          return EMPTY;
        }
        return EMPTY;
      }),
      finalize(() => commitWaitDialogRef.close())
    ).subscribe();

    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    const overlayContainer: HTMLElement = document.querySelector('.cdk-overlay-container') as HTMLElement;
    console.log('Overlay container HTML (stacked flow):\n', overlayContainer?.innerHTML);

    const tables = overlayContainer?.querySelectorAll('table') ?? [];
    console.log('Tables found in overlay (stacked flow):', tables.length);

    const openDialogs = dialog.openDialogs;
    console.log('Number of open dialogs after stacked flow:', openDialogs.length);

    tables.forEach((t, i) => {
      const rect = (t as HTMLElement).getBoundingClientRect();
      console.log(`Stacked-flow table ${i} rect:`, JSON.stringify(rect), 'offsetParent:', !!(t as HTMLElement).offsetParent);
    });

    expect(tables.length).toBeGreaterThan(0);

    dialog.closeAll();
    flush();
  }));
});
