import { Component, Input } from '@angular/core';
import { AbstractSummary } from '../../gene-llm-component.component';

@Component({
  selector: 'app-abstract-summary-table',
  templateUrl: './abstract-summary-table.component.html',
  styleUrls: ['./abstract-summary-table.component.scss']
})
export class AbstractSummaryTableComponent {
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

      // mappingSummary(ppi_genes: string[], pmids: string[]): AbstractSummary[] {
      //   const mappedGenes: AbstractSummary[] = ppi_genes.map((gene, index) => ({
      //     gene: gene,
      //     pmids: pmids[index].split('|')
      //   }
      //   ));
      //   return mappedGenes;
      // }
}
