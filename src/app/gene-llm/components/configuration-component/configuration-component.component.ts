import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-configuration-component',
  templateUrl: './configuration-component.component.html',
  styleUrls: ['./configuration-component.component.scss']
})
export class ConfigurationComponentComponent {

  @Output() getConfig = new EventEmitter<Configuration>();
  // Make sure it is bound to input instance
  @Input() set setGene(gene: string) {
    this.configuration.queryGene = gene;
  }

  defaultConfiguration: Configuration = {
    queryGene: "TANC1",
    fiScoreCutoff: 0.8,
    numberOfPubmed: 8,
    //maxQueryLength: "1000",
    cosineSimilarityCutoff: 0.38,
    llmScoreCutoff: 3,
    numberOfPathways: 8,
    fdrCutoff: 0.01,
    // model: "gpt-4o-mini"
   }

   //Parameters
   // Copy the default configuration to the configuration variable
  // to make sure that the default values are used
  // when the component is initialized
  configuration: Configuration = {...this.defaultConfiguration}

  fdrOptions = [
    1, 0.05, 0.01, 0.001, 0.0001, 0.00001
  ]
  
  resetValues() {
    this.configuration = {...this.defaultConfiguration};
  }

}

export interface Configuration {
  queryGene: string;
  fiScoreCutoff: number;
  numberOfPubmed: number;
  cosineSimilarityCutoff: number;
  llmScoreCutoff: number;
  numberOfPathways: number;
  fdrCutoff: number;
}