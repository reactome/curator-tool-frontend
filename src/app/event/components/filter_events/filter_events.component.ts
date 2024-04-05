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
  selector: 'filter-events',
  templateUrl: './filter_events.component.html',
  styleUrls: ['./filter_events.component.scss'],
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule]
})
export class FilterEventsComponent {
  // For doing search
  searchKey: string | undefined = undefined;

  @Output() updateEventTree = new EventEmitter<Array<string | undefined>>();
  selectedSpecies = "All";
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

  // TODO:  Retrieve all recursive children of Event dynamically from the Schema
  selectedClass = "Event";
  classNames: string[] = [
    'BlackBoxEvent',
    'CellDevelopmentStep',
    'CellLineagePath',
    'Depolymerisation',
    'Event',
    'FailedReaction',
    'InteractionEvent',
    'Pathway',
    'Polymerisation',
    'ReactionlikeEvent',
    'TopLevelPathway'
  ];

  // TODO:  Retrieve all attributes of selectedClass dynamically from the Schema
  selectedAttribute = "displayName";
  classToAttributes: Map<string, string[]> = new Map(
    [
      ['BlackBoxEvent', ["displayName", "dbId"]],
      ['CellDevelopmentStep',["displayName", "dbId"]],
      ['CellLineagePath',["displayName", "dbId"]],
      ['Depolymerisation',["displayName", "dbId"]],
      ['Event',["displayName", "dbId"]],
      ['FailedReaction',["displayName", "dbId"]],
      ['InteractionEvent',["displayName", "dbId"]],
      ['Pathway',["displayName", "dbId"]],
      ['Polymerisation',["displayName", "dbId"]],
      ['ReactionlikeEvent',["displayName", "dbId"]],
      ['TopLevelPathway', ["displayName", "dbId"]]
    ]);

  selectedOperand = "Equals";
  operands: string[] = [
    'Equals',
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];

  onSelectionChange(): void {
    console.debug(
      'selectedSpecies: ' + this.selectedSpecies +
      'selectedClass: ' + this.selectedClass +
      'selectedAttribute: ' + this.selectedAttribute +
      'selectedOperand: ' + this.selectedOperand +
      "; searchKey: " + this.searchKey);
      this.updateEventTree.emit([
        this.selectedSpecies,
        this.selectedClass,
        this.selectedAttribute,
        this.selectedOperand,
        this.searchKey]);
}


  getAttributes(className: string): string[] | undefined {
    return this.classToAttributes.get(className);
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

