import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-configuration-component',
  templateUrl: './configuration-component.component.html',
  styleUrls: ['./configuration-component.component.scss']
})
export class ConfigurationComponentComponent {
  @Input() configuration: Configuration = { ...DEFAULT_LLM_CONFIG };

  fdrOptions = [
    1, 0.05, 0.01, 0.001, 0.0001, 0.00001
  ]

  resetValues() {
    Object.assign(this.configuration, DEFAULT_LLM_CONFIG);
  }
}

/**
 * The settings of a Gene2Path pathway search (POST /api/llm/pathways/by-gene in curator-tool-llm), in its own field
 * names, so the object is sent as it is. The defaults are the service's.
 *
 * The old Flask service's settings (PubMed results, pathway similarity, LLM score, interaction source) are gone with
 * it: the prediction is now FI-partner enrichment, without an LLM, and papers are listed per predicted pathway. The one LLM step
 * left is the optional summary of each predicted pathway's papers (`summarize`).
 */
export const DEFAULT_LLM_CONFIG: Configuration = {
  fi_cutoff: 0.8,
  top_partners: 10,
  fdr_cutoff: 0.05,
  max_pathways: 8,
  max_evidence: 5,
  summarize: true,
}

export interface Configuration {
  /** Lowest functional-interaction score for a partner. */
  fi_cutoff: number;
  /** Partners used, best FI score first. */
  top_partners: number;
  /** Highest FDR for a predicted pathway. */
  fdr_cutoff: number;
  /** Predicted pathways listed. */
  max_pathways: number;
  /** Supporting papers listed per pathway; 0 skips the literature search. */
  max_evidence: number;
  /** Have an LLM summarize each predicted pathway's papers. Off makes the search LLM-free, and faster. */
  summarize: boolean;
}
