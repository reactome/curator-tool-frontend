import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListInstancesDialogComponent } from './list-instances-dialog.component';

describe('ListInstancesDialogComponent', () => {
  let component: ListInstancesDialogComponent;
  let fixture: ComponentFixture<ListInstancesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListInstancesDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListInstancesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
