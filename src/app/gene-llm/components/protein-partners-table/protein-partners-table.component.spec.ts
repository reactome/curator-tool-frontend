import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { componentTestImports } from 'src/testing';
import { AbstractSummary } from '../../gene-llm-component.component';
import { ProteinPartnersTableComponent } from './protein-partners-table.component';

describe('ProteinPartnersTableComponent', () => {
  let component: ProteinPartnersTableComponent;
  let fixture: ComponentFixture<ProteinPartnersTableComponent>;

  const summaries = [
    { gene: 'TANC1', pmids: ['12345678', '23456789'] },
    { gene: 'CDK1', pmids: ['34567890'] }
  ] as unknown as AbstractSummary[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [ProteinPartnersTableComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ProteinPartnersTableComponent);
    component = fixture.componentInstance;
  });

  it('starts with an empty table', () => {
    expect(component.dataSource).toEqual([]);
    expect(component.gene).toEqual([]);
    expect(component.pmids).toEqual([]);
  });

  it('shows the gene and its supporting PMIDs', () => {
    expect(component.displayedColumns).toEqual(['gene', 'pmids']);
  });

  it('takes its rows through the data setter', () => {
    component.data = summaries;

    expect(component.dataSource).toBe(summaries);
  });

  it('replaces the rows rather than accumulating them on a second binding', () => {
    component.data = summaries;
    component.data = [] as unknown as AbstractSummary[];

    expect(component.dataSource).toEqual([]);
  });
});
