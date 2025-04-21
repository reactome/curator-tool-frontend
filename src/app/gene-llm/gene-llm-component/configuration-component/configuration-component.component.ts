import { NgIf, NgFor } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCard } from '@angular/material/card';
import { MatOption } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';

@Component({
  selector: 'app-configuration-component',
  templateUrl: './configuration-component.component.html',
  styleUrl: './configuration-component.component.scss'
})
export class ConfigurationComponentComponent {

  @Output() getConfig = new EventEmitter<Configuration>();
  // Make sure it is bound to input instance
  @Input() set setGene(gene: string) {
    this.configuration.queryGene = gene;
  }
    //Parameters
   configuration: Configuration = {
    queryGene: "TANC1",
    fiScoreCutoff: parseFloat("0.8"),
    numberOfPubmed: parseInt("8"),
    //maxQueryLength: "1000",
    cosineSimilarityCutoff: parseFloat("0.38"),
    llmScoreCutoff: parseInt("3"),
    numberOfPathways: parseInt("8"),
    fdrCutoff: parseFloat("0.01"),
    // model: "gpt-4o-mini"
   }

  sendConfiguration(configuration: Configuration){
    this.getConfig.emit(configuration);
  }  

  // onGeneChange(geneName: string){
  //   this.gene = geneName;
  //   this.getConfig.emit(configuration);
  // }

  onfiScoreChange(fiScore: string){
    this.configuration.fiScoreCutoff = parseFloat(fiScore);
    this.getConfig.emit(this.configuration);
  }
  onpubmedResultsChange(numberOfPubmed: string){
    this.configuration.numberOfPubmed = parseInt(numberOfPubmed);
    this.getConfig.emit(this.configuration);
  }
  // onmaxQueryLengthChange(maxQueryLength: string){
  //   this.configuration.maxQueryLength = maxQueryLength;
  //   this.getConfig.emit(this.configuration);
  // }
  onpathwaySimilarityCutoffChange(cosineSimilarityCutoff: string){
    this.configuration.cosineSimilarityCutoff = parseFloat(cosineSimilarityCutoff);
    this.getConfig.emit(this.configuration);
  }
  onllmScoreCutoffChange(llmScoreCutoff: string){
    this.configuration.llmScoreCutoff = parseInt(llmScoreCutoff);
    this.getConfig.emit(this.configuration);
  }
  onpathwayCountChange(numberOfPathways: string){
    this.configuration.numberOfPathways = parseInt(numberOfPathways);
    this.getConfig.emit(this.configuration);
  }
  onFdrChange(fdrCutoff: string){
    this.configuration.fdrCutoff = parseFloat(fdrCutoff);
    this.getConfig.emit(this.configuration);
  }
  // onModelChange(model: string){
  //   this.configuration.model = model;
  //   this.getConfig.emit(this.configuration);
  // }
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