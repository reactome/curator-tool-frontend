import { Component, Input } from '@angular/core';
import { AbstractSummary } from '../gene-llm-component.component';
import { NgIf, NgFor } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardActions, MatCardHeader, MatCardFooter, MatCardTitle } from '@angular/material/card';
import { MatOption } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatRow, MatRowDef, MatFooterRow, MatHeaderRow, MatCell, MatTable, MatHeaderCell, MatHeaderRowDef } from '@angular/material/table';
import { ConfigurationComponentComponent } from '../configuration-component/configuration-component.component';

@Component({
  selector: 'app-abstract-summary-table',
  templateUrl: './abstract-summary-table.component.html',
  styleUrl: './abstract-summary-table.component.scss'
})
export class AbstractSummaryTableComponent {
    @Input() gene: string[] = ["gene"]
    @Input() pmids: string[] = ['000', '111', '44'];
    dataSource: AbstractSummary[] = [];
    displayedColumns: string[] = ['gene', 'pmids'];

      constructor() {
        this.dataSource = this.mappingSummary(this.gene, this.pmids);
        console.log('compDataSouce', this.dataSource);
      }

      mappingSummary(ppi_genes: string[], pmids: string[]): AbstractSummary[] {
        const mappedGenes: AbstractSummary[] = ppi_genes.map((gene, index) => ({
          gene: gene,
          pmids: pmids[index].split('|')
        }
        ));
        return mappedGenes;
      }
}
