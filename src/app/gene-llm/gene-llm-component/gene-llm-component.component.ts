import { Component } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf, NgFor } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, concatMap, of, throwError } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { environment } from 'src/environments/environment.dev';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatOptgroup, MatOption, MatSelect, MatSelectModule} from '@angular/material/select';

@Component({
  selector: 'app-gene-llm-component',
  templateUrl: './gene-llm-component.component.html',
  styleUrls: ['./gene-llm-component.component.scss'],
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, NgIf, NgFor, MatProgressSpinnerModule, MatDividerModule, MatExpansionModule, MatSelect, MatOption]
})
export class GeneLlmComponentComponent {

  // private LLM_HOST = "http://127.0.0.1:5000/"
  private LLM_HOST = environment.llmURL;
  private LLM_QUERY_GENE_URL = this.LLM_HOST + "/query/"
  private LLM_FULLTEXT_ANALYSIS_URL = this.LLM_HOST + '/fulltext/'

  content: string | undefined;
  details: Interacting_Pathway_Detail[] | undefined;
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
      this.content = this.hiliteGene(result.content, gene);
      if (this.content) {
        this.content = this.addLinkToPMID(this.content);
      }
      this.details = this.splitDetails(result.docs,
        result.pathway_name_2_id,
        gene);
      this.during_query = false;
    })
  }

  private splitDetails(details: string | undefined,
    pathway_name_2_id: any,
    queryGene: string) {
    if (details === undefined)
      return undefined;
    let paragraphs = details.split('\n\n')
    let detailObjects: Interacting_Pathway_Detail[] = [];
    for (let i in paragraphs) { // This give us an index
      let paragraph = paragraphs[i];
      // Need to re-initialize this. Otherwise, the previous status is kept.
      let regex = /PMID:(\d+)/g;
      let match = regex.exec(paragraph);
      let pmid = match ? match[1] : undefined;
      let pathway = this.extractPathwayName(paragraph);
      let pathwayId = pathway ? pathway_name_2_id[pathway] : undefined;
      let text = paragraph;
      if (pathway) {
        let index = paragraph.indexOf(pathway);
        text = paragraph.substring(index + pathway.length + 2).trim();
        let tmp = this.hiliteGene(text, queryGene);
        text = tmp ? tmp : "";
      }
      let detailObject: Interacting_Pathway_Detail = {
        pmid: pmid,
        pathway: pathway,
        pathwayId: pathwayId,
        text: text,
        isWorkingFullText: true, // Ensure the spinner 
        queryGene: queryGene
      };
      detailObjects.push(detailObject);
    }
    return detailObjects;
  }

  private extractPathwayName(text: string | undefined) {
    if (text === undefined)
      return undefined;
    let regex = new RegExp('PATHWAY_NAME:"(.+)"', 'g');
    let match = regex.exec(text);
    return match ? match[1] : undefined;
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

  private hiliteGene(text: string | undefined, queryGene: string) {
    if (text === undefined)
      return text;
    let regex = new RegExp(`(${queryGene})`, 'gi');
    let hiliteGene = "<b class=\"query_gene\">$1</b>"
    text = text.replace(regex, hiliteGene);
    return text;
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

  fetchFullText(detail: Interacting_Pathway_Detail) {
    console.debug('Fetching full text...');
    const url = this.LLM_FULLTEXT_ANALYSIS_URL + detail.pmid + "/" + detail.queryGene
    detail.isWorkingFullText = true;
    return this.http.get<LLM_Result[]>(url).pipe(
      concatMap((result: LLM_Result[]) => {
        return of(result);
      }),
      catchError((err: Error) => {
        console.log("Error to query gene: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 100
        });
        return throwError(() => err);
      })
    ).subscribe(results => {
      detail.isWorkingFullText = false;
      // Check if there is any error here
      if (results.length == 0) {
        detail.failure = 'Uknown error at the server. Please report the error or try again later.'
      }
      else {
        // Peek the first and see if there is any error
        let firstResult = results[0];
        if (firstResult.failure) {
          detail.failure = firstResult.failure;
          if (detail.failure.toLocaleLowerCase() === "The PDF full text paper cannot be found at the server".toLocaleLowerCase()) {
            detail.needPDFFile = true;
          }
        }
        else {
          for (let result of results) {
            result.content = this.replaceNewLine(result.content);
            result.content = this.hiliteGene(result.content, detail.queryGene);
            result.docs = this.hiliteGene(result.docs, detail.queryGene);
          }
          detail.fullPaperResults = results;
        }
      }
    });
  }

  uploadPDFFile(event: any, detail: Interacting_Pathway_Detail) {
    console.debug("Uploading pdf file: ", event.target.files[0]);
    const file = event.target.files[0];
    if (file) {
      detail.pdfUrl = file.name;
      let formData = new FormData();
      formData.append("pdf", file);
      if (detail.pmid)
        formData.append("pmid", detail.pmid);
      let url = this.LLM_FULLTEXT_ANALYSIS_URL + "uploadPDF";
      this.http.post(url, formData).pipe(
        concatMap((result: any) => {
          return of(result);
        }),
        catchError((err: Error) => {
          console.log("Error to submit pdfUrl: \n" + err.message, "Close", {
            panelClass: ['warning-snackbar'],
            duration: 100
          });
          return throwError(() => err);
        })
      ).subscribe(result => {
        if (result["status"] === "success") {
          console.debug("The PDF is downloaded successfully.");
          detail.failure = undefined;
          detail.needPDFFile = false;
          this.fetchFullText(detail);
        }
        else {
          detail.failure = result['failure'];
          detail.isWorkingFullText = false;
        }
      });
    }
  }

  // The code cannot work at the server side. It is blocked by PMC becaue of the copyright issue!
  submitPDFUrlForProcess(pdfUrl: string,
    detail: Interacting_Pathway_Detail) {
    console.debug('Paper PDF url: ', pdfUrl);
    let url = this.LLM_FULLTEXT_ANALYSIS_URL + "download/" + detail.pmid + "?pdfUrl=" + pdfUrl;
    detail.isWorkingFullText = true;
    this.http.get<any>(url).pipe(
      concatMap((result: any) => {
        return of(result);
      }),
      catchError((err: Error) => {
        console.log("Error to submit pdfUrl: \n" + err.message, "Close", {
          panelClass: ['warning-snackbar'],
          duration: 100
        });
        return throwError(() => err);
      })
    ).subscribe(result => {
      if (result["status"] === "success") {
        console.debug("The PDF is downloaded successfully.");
        this.fetchFullText(detail);
      }
      else {
        detail.failure = result['failure'];
        detail.isWorkingFullText = false;
      }
    });
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

interface Interacting_Pathway_Detail {
  pathway?: string;
  pathwayId?: string;
  pmid?: string;
  text: string;
  // For loading full text
  isWorkingFullText: boolean;
  fullPaperResults?: LLM_Result[];
  queryGene: string;
  failure?: string;
  needPDFFile?: boolean;
  pdfUrl?: string;
}