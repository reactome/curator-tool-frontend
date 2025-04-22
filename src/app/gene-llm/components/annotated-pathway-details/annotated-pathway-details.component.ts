import { Component, Input } from '@angular/core';
import { Interacting_Pathway_Detail } from '../../gene-llm-component.component';
import { catchError, concatMap, of, throwError } from 'rxjs';

@Component({
  selector: 'app-annotated-pathway-details',
  templateUrl: './annotated-pathway-details.component.html',
  styleUrls: ['./annotated-pathway-details.component.scss']
})
export class AnnotatedPathwayDetailsComponent {
  @Input() details: Interacting_Pathway_Detail[] = [];

    fetchFullText(detail: Interacting_Pathway_Detail) {};
    uploadPDFFile(event: any, detail: Interacting_Pathway_Detail) {};

}
