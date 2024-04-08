import {Component, EventEmitter, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {DataService} from "../../../core/services/data.service";
import {SchemaClass} from "../../../core/models/reactome-schema.model";

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
  selectedSpecies = "All";
  selectedClass = "Event";
  selectedAttribute = "displayName";
  selectedOperand = "Equals";
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
  classNames: string[] = [];
  classToAttributes: Map<string, string[]> = new Map();
  operands: string[] = [
    'Equals',
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];

  constructor(private service: DataService) {
    // Populate all Event (and children) classes into this.classNames
    service.fetchSchemaClassTree().subscribe(_ => {
      let eventSchemaClass = service.getSchemaClass("Event");
      let classNames: Set<string> = new Set(['Event']);
      this.getChildren(eventSchemaClass!, classNames);
      this.classNames = Array.from(classNames).sort((a, b) => a.localeCompare(b));

      // Populate className's attribute names into classToAttributes
      this.classNames.forEach(className => {
        this.classToAttributes.set(className, []);
        service.fetchSchemaClass(className).subscribe(populatedSchemaClass => {
          if (populatedSchemaClass.attributes) {
            populatedSchemaClass.attributes.forEach(attr => {
              this.classToAttributes.get(className)!.push(attr.name);
            });
            this.classToAttributes.get(className)!.sort((a, b) => a.localeCompare(b));
          }
        })
      })
    })
  }

  @Output() updateEventTree = new EventEmitter<Array<string | undefined>>();

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

  /**
   * Populate into clsNames all the recursive child classes of schemaClass
   * @param schemaClass
   * @param clsNames
   */
  getChildren(schemaClass: SchemaClass, clsNames: Set<string>): void {
    if (schemaClass.children) {
      schemaClass.children.forEach(child => {
        clsNames.add(child.name);
        this.getChildren(child, clsNames);
      });
    }
  }
}

