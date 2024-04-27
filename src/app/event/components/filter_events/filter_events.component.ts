import {ChangeDetectorRef, Component, EventEmitter, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip'
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {DataService} from "../../../core/services/data.service";
import {AttributeDataType, SchemaClass} from "../../../core/models/reactome-schema.model";

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
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, MatButtonModule, MatTooltipModule]
})
export class FilterEventsComponent {
  // For doing search
  selectedSpecies = "All";
  selectedClass = "Reaction";
  selectedAttributes: string[] = ["displayName"];
  selectedOperands: string[] = ["Contains"];
  /* NB. Since 'IS NOT NULL' and 'IS NULL' don't require a searchKey, populating every 'empty' of the four
  possible positions in searchKeys with a non-empty string placeholder ensures that each attribute-operand
  tuple gets assigned the correct searchKey at the curator-tool-ws end. If searchKeys had been assigned []
  or ["","","",""] below, e.g. in the case of: 'displayName IS NOT NULL' and 'dbId contains "12"', the back-end
  would have incorrectly reconstructed 'displayName IS NOT NULL "12"'.
  */
  searchKeys: string[] = ["na", "na", "na", "na"];
  hide_clauses: boolean[] = [false, true, true, true];

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
  classToAttributeToType: Map<string, Map<string, number>> = new Map();
  operands: string[] = [
    'Equals',
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService) {
    // Populate all Event (and children) classes into this.classNames
    service.fetchSchemaClassTree().subscribe(_ => {
      let eventSchemaClass = service.getSchemaClass("Event");
      let classNames: Set<string> = new Set(['Event']);
      this.getChildren(eventSchemaClass!, classNames);
      // Disallow search by attribute value for class TopLevelPathway - not necessary and not catered for anyway
      classNames.delete("TopLevelPathway");
      this.classNames = Array.from(classNames).sort((a, b) => a.localeCompare(b));

      // Populate className's attribute names into classToAttributes
      this.classNames.forEach(className => {
        this.classToAttributes.set(className, []);
        service.fetchSchemaClass(className).subscribe(populatedSchemaClass => {
          if (populatedSchemaClass.attributes) {
            populatedSchemaClass.attributes.forEach(attr => {
              this.classToAttributes.get(className)!.push(attr.name);
              if (!this.classToAttributeToType.has(className)) {
                this.classToAttributeToType.set(className, new Map());
              }
              this.classToAttributeToType.get(className)!.set(attr.name, attr.type);
            });
            this.classToAttributes.get(className)!.sort(
              (a, b) => a.localeCompare(b));
          }
        })
      })
    })
  }

  @Output() updateEventTree = new EventEmitter<Array<string[]>>();

  onSelectionChange(): void {
    let selectedAttributeTypes: string[] = [];
    this.selectedAttributes.forEach(attribute => {
      if (attribute) {
        let selectedAttributeType =
          this.classToAttributeToType.get(this.selectedClass)!.get(attribute) == AttributeDataType.INSTANCE ?
            "instance" : "primitive";
        selectedAttributeTypes.push(selectedAttributeType);
      }
    });
    console.debug(
      'selectedSpecies: ' + this.selectedSpecies +
      'selectedClass: ' + this.selectedClass +
      'selectedAttributes: ' + this.selectedAttributes +
      'selectedAttributeTypes: ' + selectedAttributeTypes +
      'selectedOperands: ' + this.selectedOperands +
      "; searchKeys: " + this.searchKeys);
      this.updateEventTree.emit([
        [this.selectedSpecies],
        [this.selectedClass],
        this.selectedAttributes,
        selectedAttributeTypes,
        this.selectedOperands,
        this.searchKeys]);
  }

  onClassSelection(): void {
    // Reflect the newly selectedClass's attributes in all 'select attributes' mat-form-fields
    this.cdr.detectChanges();
  }

  showClause(pos: number): void {
    this.hide_clauses[pos] = false;
    this.cdr.detectChanges();
  }

  hideClause(pos: number): void {
    this.hide_clauses[pos] = true;
    // Remove any user-selected values in clause at pos
    this.selectedAttributes.splice(pos, 1);
    this.selectedOperands.splice(pos, 1);
    this.searchKeys[pos] = "na";
    (<HTMLInputElement>document.getElementById("searchKey"+pos)).value="";
    this.cdr.detectChanges();
  }


  getAttributes(className: string): string[] | undefined {
    return this.classToAttributes.get(className);
  }

  recordSearchKey(event: Event, pos: number) {
    const text = (event.target as HTMLInputElement).value;
    if (text !== '') {
      this.searchKeys[pos] = text;
    } else {
      this.searchKeys[pos] = 'na';
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

