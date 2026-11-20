import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Interacting_Pathway_Detail } from '../../gene-llm-component.component';

@Component({
  selector: 'app-predicted-pathway-details',
  templateUrl: './predicted-pathway-details.component.html',
  styleUrls: ['./predicted-pathway-details.component.scss']
})
export class PredictedPathwayDetailsComponent {
  @Input() details: Interacting_Pathway_Detail[] = [];
  @Output() fullTextDetails = new EventEmitter<Interacting_Pathway_Detail>();
  @Output() pdfFileDetails = new EventEmitter<{event: any, detail: Interacting_Pathway_Detail}>();
    

    fetchFullText(detail: Interacting_Pathway_Detail) {this.fullTextDetails.emit(detail)};
    uploadPDFFile(event: any, detail: Interacting_Pathway_Detail) {this.pdfFileDetails.emit({event, detail})};

}
