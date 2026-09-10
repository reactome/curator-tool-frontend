import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { componentTestImports, makeInstance, provideDialogContext } from 'src/testing';
import { ReferrersDialogComponent } from './referrers-dialog.component';

describe('ReferrersDialogComponent', () => {
  let component: ReferrersDialogComponent;
  let dialogRef: MatDialogRef<ReferrersDialogComponent>;

  const instance = makeInstance({ dbId: 100, displayName: 'Glycolysis' });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [ReferrersDialogComponent],
      providers: [
        ReferrersDialogComponent,
        // The component injects the instance directly as MAT_DIALOG_DATA.
        ...provideDialogContext(instance),
        { provide: MAT_DIALOG_DATA, useValue: instance }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    component = TestBed.inject(ReferrersDialogComponent);
    dialogRef = TestBed.inject(MatDialogRef);
  });

  it('takes the instance whose referrers are being shown from the dialog data', () => {
    expect(component.instance.dbId).toEqual(100);
  });

  it('builds a relative stable URL for the referrer list', () => {
    // Deliberately relative: a leading slash resolves from the server root and bypasses the
    // <base href> the deployed site is served under, so the link 404s in production.
    expect(component.referrersUrl).toEqual('schema_view/referrers/100');
    expect(component.referrersUrl.startsWith('/')).toBeFalse();
  });

  it('closes without a result when cancelled', () => {
    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
