import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-configuration-component',
  templateUrl: './configuration-component.component.html',
  styleUrls: ['./configuration-component.component.scss']
})
export class ConfigurationComponentComponent {

  @Input() configuration: Configuration = {...DEFAULT_LLM_CONFIG};
  
  fdrOptions = [
    1, 0.05, 0.01, 0.001, 0.0001, 0.00001
  ]
  
  resetValues() {
    Object.assign(this.configuration, DEFAULT_LLM_CONFIG);
  }

}

// Export a default configuration object
export const DEFAULT_LLM_CONFIG : Configuration = {
  queryGene: "TANC1",
  fiScoreCutoff: 0.8,
  numberOfPubmed: 8,
  //maxQueryLength: "1000",
  cosineSimilarityCutoff: 0.38,
  llmScoreCutoff: 3,
  numberOfPathways: 8,
  fdrCutoff: 0.01,
  interactionSource: "intact_biogrid",
  filterPPIs: true,
  // model: "gpt-4o-mini"
}

export interface Configuration {
  queryGene: string;
  fiScoreCutoff: number;
  numberOfPubmed: number;
  cosineSimilarityCutoff: number;
  llmScoreCutoff: number;
  numberOfPathways: number;
  fdrCutoff: number;
  interactionSource?: string; // "intact_biogrid" | "reactome_fis";
  filterPPIs?: boolean;
}