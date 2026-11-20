import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { componentTestImports } from 'src/testing';
import { Interacting_Pathway_Detail } from '../../gene-llm-component.component';
import { PredictedPathwayDetailsComponent } from './predicted-pathway-details.component';

describe('PredictedPathwayDetailsComponent', () => {
  let component: PredictedPathwayDetailsComponent;
  let fixture: ComponentFixture<PredictedPathwayDetailsComponent>;

  const detail = {
    pmid: '12345678',
    queryGene: 'TANC1',
    pathway: 'Cell Cycle'
  } as unknown as Interacting_Pathway_Detail;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [PredictedPathwayDetailsComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PredictedPathwayDetailsComponent);
    component = fixture.componentInstance;
  });

  it('starts with no details to show', () => {
    expect(component.details).toEqual([]);
  });

  it('asks the parent to fetch the full text for one detail', () => {
    // This component only renders; the parent owns the HTTP call.
    const emitted: Interacting_Pathway_Detail[] = [];
    component.fullTextDetails.subscribe(d => emitted.push(d));

    component.fetchFullText(detail);

    expect(emitted).toEqual([detail]);
  });

  it('forwards an uploaded PDF along with the detail it belongs to', () => {
    // The detail has to travel with the event, or the parent cannot tell which row the
    // upload was for.
    const emitted: { event: any, detail: Interacting_Pathway_Detail }[] = [];
    component.pdfFileDetails.subscribe(e => emitted.push(e));
    const event = { target: { files: ['paper.pdf'] } };

    component.uploadPDFFile(event, detail);

    expect(emitted.length).toEqual(1);
    expect(emitted[0].event).toBe(event);
    expect(emitted[0].detail).toBe(detail);
  });
});
