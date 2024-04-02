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
  // For doing search
  searchKey: string | undefined = undefined;
  selected = "All";
  @Output() updateEventTree = new EventEmitter<Array<string | undefined>>();
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

  onSelectionChange(): void {
    console.debug('selected: ' + this.selected + "; searchKey: " + this.searchKey);
    this.updateEventTree.emit([this.selected, this.searchKey]);
  }



  recordSearchKey(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.searchKey = text;
    // Make sure reset it to undefined if nothing there so that
    // no empty string sent to the server
    if (this.searchKey !== undefined && this.searchKey.length === 0) {
      this.searchKey = undefined;
    }
  }
}

