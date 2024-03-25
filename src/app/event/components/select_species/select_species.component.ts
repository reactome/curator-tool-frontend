import {Component, EventEmitter, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';

interface Species {
  value: string;
  viewValue: string;
}

/**
 * @title Basic select
 */
@Component({
  selector: 'select-species',
  templateUrl: './select_species.component.html',
  styleUrls: ['./select_species.component.scss'],
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule]
})
export class SelectSpeciesComponent {
  selected = "All";
  @Output() updateEventTree = new EventEmitter<string>();
  species: Species[] = [
    {value: 'All', viewValue: 'All'},
    // TODO: The value below is for temporary testing only
    {value: 'Control', viewValue: 'Control'},
    {value: 'Homo sapiens', viewValue: 'Homo sapiens'},
    {value: 'Caenorhabditis elegans', viewValue: 'Caenorhabditis elegans'},
    {value: 'Danio rerio', viewValue: 'Danio rerio'},
    {value: 'Drosophila Melanogaster', viewValue: 'Drosophila Melanogaster'},
    {value: 'Gallus Gallus', viewValue: 'Gallus Gallus'},
    {value: 'Fugu Rubripes', viewValue: 'Fugu Rubripes'},
    {value: 'Mus musculus', viewValue: 'Mus musculus'}
  ];

  onSelectionChange(): void {
    console.debug('selected: ' + this.selected)
    this.updateEventTree.emit(this.selected);
  }
}

