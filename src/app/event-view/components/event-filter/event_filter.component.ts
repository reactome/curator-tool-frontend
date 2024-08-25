import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChange, ViewEncapsulation} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatInput, MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltip, MatTooltipModule} from '@angular/material/tooltip'
import {MatSelectModule} from '@angular/material/select';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {DataService} from "../../../core/services/data.service";
import {AttributeDataType, SchemaAttribute, SchemaClass} from "../../../core/models/reactome-schema.model";
import {Instance} from "../../../core/models/reactome-instance.model";
import {NgFor, NgIf} from "@angular/common";

/**
 * @title Basic select
 */
@Component({
  selector: 'event-filter',
  templateUrl: './event_filter.component.html',
  styleUrls: ['./event_filter.component.scss'],
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, NgFor, MatInput, MatTooltip]
})
export class EventFilterComponent {

  // The list may need to be configured by an external file.
  species: string[] = [
    'All',
    'Homo sapiens',
    'C. elegans',
    'D. melanogaster',
    'Gallus gallus',
    'Fugu rubripes',
    'Mus musculus'
  ];
  @Output() speciesChanged = new EventEmitter<string>();
  @Output() filterTextChanged = new EventEmitter<string>();

  // Use this as the default for the time being.
  // Most likely we will parse the URL to get the selected species. 
  selected: string = 'All';

  onSpeciesSelectionChange(event: any) {
    console.debug('Selected value:', event.value);
    // Need a little bit convert
    let species = undefined;
    if (event.value === 'C. elegans')
      species = 'Caenorhabditis elegans';
    else if (event.value === 'D. melanogaster')
      species = 'Drosophila melanogaster';
    else
      species = event.value;
    this.speciesChanged.emit(species);
  }

  handleFilterEvent(text: any) {
    console.debug('filter text for events: ' + text);
    this.filterTextChanged.emit(text);
  }
  
}

