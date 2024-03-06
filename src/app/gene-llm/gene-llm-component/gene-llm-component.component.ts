import { Component } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, concatMap, of, throwError } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-gene-llm-component',
  templateUrl: './gene-llm-component.component.html',
  styleUrls: ['./gene-llm-component.component.scss'],
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, NgIf, MatProgressSpinnerModule]
})
export class GeneLlmComponentComponent {

  private LLM_HOST = "http://127.0.0.1:5000/"
  private LLM_QUERY_GENE_URL = this.LLM_HOST + "query/"

  content: string | undefined;
  details: string | undefined;
  failure: string | undefined;
  annotated_pathway_content: string | undefined;
  annotated_pathway_details: string | undefined;
  during_query: boolean = false;

  constructor(private http: HttpClient) {
  }

  queryGene(gene: string) {
    console.debug('query gene: ', gene);
    this.during_query = true;
    const url = this.LLM_QUERY_GENE_URL + gene;
    return this.http.get<LLM_Result>(url).pipe(
      concatMap((result: LLM_Result) => {
        return of(result);
      }),
      catchError((err: Error) => {
        console.log("Error to query gene: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 100
        });
        return throwError(() => err);
      })
    ).subscribe(result => {
      this.annotated_pathway_content = result.annotated_pathways_content;
      this.annotated_pathway_details = result.annotated_pathways_docs;
      if (this.annotated_pathway_details) {
        // Perform some formatting
        this.annotated_pathway_details = this.replaceNewLine(this.annotated_pathway_details);
        this.annotated_pathway_details = this.addPathwayLinks(this.annotated_pathway_details,
          result.pathway_name_2_id,
          false);
      }
      if (this.annotated_pathway_content) {
        this.annotated_pathway_content = this.addPathwayLinks(this.annotated_pathway_content, result.pathway_name_2_id, false);
      }
      this.failure = result.failure;
      this.content = result.content
      if (this.content) {
        this.content = this.addLinkToPMID(this.content);
      }
      this.details = result.docs
      if (this.details) {
        let tmp = this.replaceNewLine(this.details);
        tmp = this.addPathwayLinks(tmp, result.pathway_name_2_id);
        this.details = this.addLinkToPMID(tmp);
      }
      this.during_query = false;
    })
  }

  private addPathwayLinks(text: string | undefined,
    name2id: any,
    for_pathway_name: boolean = true) {
    if (text === undefined)
      return text;
    // Create a map from name to id first for links
    let replacedText = text
    for (let key in name2id) {
      if (name2id.hasOwnProperty(key)) {
        let pathway = key;
        let dbId = name2id[pathway];
        let regex = undefined;
        let link = undefined;
        if (for_pathway_name) {
          regex = new RegExp('PATHWAY_NAME:"' + pathway + '"', 'g');
          link = ' PATHWAY: <a href="https://reactome.org/PathwayBrowser/#/' + dbId + '" target="reactome">' + pathway + '</a>';
        }
        else {
          regex = new RegExp(pathway, 'g');
          link = '<a href="https://reactome.org/PathwayBrowser/#/' + dbId + '" target="reactome">' + pathway + '</a>';
        }
        replacedText = replacedText.replace(regex, link);
      }
    }
    return replacedText;
  }


  private addLinkToPMID(text: string | undefined) {
    if (text === undefined)
      return text;
    let regex = /PMID:(\d+)/g;
    let replacedText = text.replace(regex, '<a href="https://pubmed.ncbi.nlm.nih.gov/$1" target="pubmed">PMID:$1</a>');
    console.debug(replacedText)
    return replacedText;
  }

  private replaceNewLine(text: string | undefined) {
    if (text === undefined)
      return text;
    let replacedText = text.replace(/\n/g, '<br>')
    return replacedText;
  }

}

interface LLM_Result {
  content?: string;
  docs?: string;
  failure?: string;
  annotated_pathways_content?: string;
  annotated_pathways_docs?: string;
  pathway_name_2_id: any
}
