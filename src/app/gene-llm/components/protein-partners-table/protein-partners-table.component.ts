import { Component, Input } from '@angular/core';
import { AbstractSummary } from '../../gene-llm-component.component';

@Component({
  selector: 'app-protein-partners-table',
  templateUrl: './protein-partners-table.component.html',
  styleUrls: ['./protein-partners-table.component.scss']
})
export class ProteinPartnersTableComponent {
    @Input() gene: string[] = []
    @Input() pmids: string[] = [];
     dataSource: AbstractSummary[] = [];
    @Input() set data(dataSource: AbstractSummary[]) {
      this.dataSource = dataSource;
    }
    displayedColumns: string[] = ['gene', 'pmids'];

      constructor() {
        // this.dataSource = this.mappingSummary(this.gene, this.pmids);
        console.log('compDataSouce', this.dataSource);
      }
}
