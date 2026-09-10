import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { componentTestImports } from 'src/testing';
import { QAReportTable } from './qa-report-table.component';

describe('QAReportTable', () => {
  let component: QAReportTable;
  let fixture: ComponentFixture<QAReportTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [QAReportTable],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(QAReportTable);
    component = fixture.componentInstance;
  });

  it('keys each row by its column name', () => {
    component.colNames = ['DB_ID', 'Display name', 'Issue'];
    component.rows = [['102', 'B -> C', 'species is empty']];

    component.ngOnInit();

    expect(component.dataSource.data).toEqual([
      { DB_ID: '102', 'Display name': 'B -> C', Issue: 'species is empty' }
    ]);
  });

  it('builds one row object per report row', () => {
    component.colNames = ['DB_ID', 'Issue'];
    component.rows = [['101', 'a'], ['102', 'b'], ['103', 'c']];

    component.ngOnInit();

    expect(component.dataSource.data.length).toEqual(3);
  });

  it('parses an embedded instance cell into an object the template can link', () => {
    // The backend serialises an instance-valued cell as JSON; leaving it as a string would
    // render the raw JSON in the table.
    component.colNames = ['DB_ID', 'Referrer'];
    component.rows = [['102', '{"dbId":100,"displayName":"Glycolysis"}']];

    component.ngOnInit();

    expect(component.dataSource.data[0]['Referrer'])
      .toEqual({ dbId: 100, displayName: 'Glycolysis' });
  });

  it('leaves a plain string cell as a string', () => {
    component.colNames = ['Issue'];
    component.rows = [['species is empty']];

    component.ngOnInit();

    expect(component.dataSource.data[0]['Issue']).toEqual('species is empty');
  });

  it('builds no data source when there are no rows', () => {
    component.colNames = ['DB_ID'];
    component.rows = [];

    component.ngOnInit();

    expect(component.dataSource).toBeUndefined();
  });

  it('builds no data source when the column names are missing', () => {
    // Without column names there is nothing to key the cells by, so rendering would produce
    // an all-undefined table.
    component.colNames = [];
    component.rows = [['102']];

    component.ngOnInit();

    expect(component.dataSource).toBeUndefined();
  });

  it('opens a reported instance in a new tab', () => {
    const open = spyOn(window, 'open');

    component.navigate('102');

    expect(open).toHaveBeenCalledWith('schema_view/instance/102', '_blank');
  });
});
