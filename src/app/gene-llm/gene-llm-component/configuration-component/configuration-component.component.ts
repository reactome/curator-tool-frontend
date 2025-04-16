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
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, NgIf, NgFor, MatProgressSpinnerModule, 
    MatDividerModule, MatExpansionModule, MatSelect, MatOption, MatIcon, MatCard],
  templateUrl: './configuration-component.component.html',
  styleUrl: './configuration-component.component.scss'
})
export class ConfigurationComponentComponent {

  @Output() getConfig = new EventEmitter<Configuration>();
  // Make sure it is bound to input instance
  @Input() set setConfig(configuration: Configuration) {
    this.sendConfiguration(configuration);
  }
    //Parameters
    gene: string = "TANC1";
    fiScore: string = "0.8";
    pubmedResults: string = "8";
    maxQueryLength: string = "1000";
    pathwaySimilarityCutoff: string = "0.38";
    llmScoreCutoff: string = "3";
    pathwayCount: string ="8";
    fdr: string = "0.01";
    model: string = "gpt-4o-mini"

  sendConfiguration(configuration: Configuration){
    this.getConfig.emit(configuration);
  }  

  onGeneChange(geneName: string){
    this.gene = geneName;
  }
  onfiScoreChange(fiScore: string){
    this.fiScore = fiScore;
  }
  onpubmedResultsChange(pubmedResults: string){
    this.pubmedResults = pubmedResults;
  }
  onmaxQueryLengthChange(maxQueryLength: string){
    this.maxQueryLength = maxQueryLength;
  }
  onpathwaySimilarityCutoffChange(pathwaySimilarityCutoff: string){
    this.pathwaySimilarityCutoff = pathwaySimilarityCutoff;
  }
  onllmScoreCutoffChange(llmScoreCutoff: string){
    this.llmScoreCutoff = llmScoreCutoff;
  }
  onpathwayCountChange(pathwayCount: string){
    this.pathwayCount = pathwayCount;
  }
  onFdrChange(fdr: string){
    this.fdr = fdr;
  }
  onModelChange(model: string){
    this.model = model;
  }
}

export interface Configuration {
  queryGene: string;
  fiScoreCutoff: number;
  numberOfPubmed: number;
  // maxQueryLength: number;
  cosineSimilarityCutoff: number;
  llmScoreCutoff: number;
  numberOfPathways: number;
  fdrCutoff: number;
  // llmModel: string;
}