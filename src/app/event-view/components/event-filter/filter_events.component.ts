import {ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip'
import {MatSelectModule} from '@angular/material/select';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {DataService} from "../../../core/services/data.service";
import {AttributeDataType, SchemaAttribute, SchemaClass} from "../../../core/models/reactome-schema.model";
import {Instance} from "../../../core/models/reactome-instance.model";
import {NgIf} from "@angular/common";

interface Species {
  value: string;
  viewValue: string;
}

/**
 * @title Basic select
 */
@Component({
  selector: 'filter-events',
  templateUrl: './filter_events.component.html',
  styleUrls: ['./filter_events.component.scss'],
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, MatButtonModule, MatTooltipModule, MatCardModule, NgIf]
})
export class FilterEventsComponent {

  // TODO: There are many more species in Neo4J than those below (offered as filters in CuratorTool)
  species: Species[] = [
    {value: 'All', viewValue: 'All'},
    {value: 'Homo sapiens', viewValue: 'Homo sapiens'},
    {value: 'Caenorhabditis elegans', viewValue: 'Caenorhabditis elegans'},
    {value: 'Danio rerio', viewValue: 'Danio rerio'},
    {value: 'Drosophila Melanogaster', viewValue: 'Drosophila Melanogaster'},
    {value: 'Gallus Gallus', viewValue: 'Gallus Gallus'},
    {value: 'Fugu Rubripes', viewValue: 'Fugu Rubripes'},
    {value: 'Mus musculus', viewValue: 'Mus musculus'}
  ];
  
}

