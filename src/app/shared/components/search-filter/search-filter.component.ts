import {ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {DataService} from "../../../core/services/data.service";
import {AttributeDataType, SchemaAttribute, SchemaClass} from "../../../core/models/reactome-schema.model";
import {NgFor} from "@angular/common";

interface Species {
  value: string;
  viewValue: string;
}

/**
 * @title Basic select
 */
@Component({
  selector: 'search-filter',
  templateUrl: './search-filter.component.html',
  styleUrls: ['./search-filter.component.scss'],
})
export class SearchFilterComponent {
  @Input() set selectedSchemaClass(selectedSchemaClass: string) {
    this.selectedClass = selectedSchemaClass;
  }
  // Adding flags to use the filter in the schema
  @Input() isSchemaView: boolean = false;
  @Input() set schemaClassAttributes(schemaClassAttributes: SchemaAttribute[]){
    this.schemaAttributes = schemaClassAttributes;
  }
  @Input() schemaClassNodes: SchemaClass[] = [];
  // For doing search
  schemaAttributes: SchemaAttribute[] = [];
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
  searchKeys: string[] = [];
  hide_clauses: boolean[] = [false, true, true, true];
  numberOfAttributes: number = 1;

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
    'Equal',
    'Contains',
    'Does not contain',
    '!=',
    'Use REGEXP',
    'IS NOT NULL',
    'IS NULL'
  ];
  hideShowButtonLabel: string = "Show Filters";
  hideSearchPanel: string = "hidden";

  constructor(
    private cdr: ChangeDetectorRef,
    private service: DataService) {
    // Populate all Event (and children) classes into this.classNames
    service.fetchSchemaClassTree().subscribe(_ => {
      if (this.isSchemaView) {
        let schemaClass = service.getSchemaClass(this.selectedClass);
        let classNames: Set<string> = new Set([this.selectedClass]);
        this.getChildren(schemaClass!, classNames);
        this.classNames = Array.from(classNames).sort((a, b) => a.localeCompare(b));
      } else {
        let eventSchemaClass = service.getSchemaClass("Event");
        let classNames: Set<string> = new Set(['Event']);
        this.getChildren(eventSchemaClass!, classNames);
        // Disallow search by attribute value for class TopLevelPathway - not necessary and not catered for anyway
        classNames.delete("TopLevelPathway");
        this.classNames = Array.from(classNames).sort((a, b) => a.localeCompare(b));
      }

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

  onSearchSelectionChange(): void {
    // this.selectedAttributes.forEach(attribute => {
    //   if (attribute) {
    //     let selectedAttributeType =
    //       this.classToAttributeToType.get(this.selectedClass)!.get(attribute) == AttributeDataType.INSTANCE ?
    //         "instance" : "primitive";
    //     selectedAttributeTypes.push(selectedAttributeType);
    //   }
    // });
    console.debug(
      'selectedSpecies: ' + this.selectedSpecies +
      'selectedClass: ' + this.selectedClass +
      'selectedAttributes: ' + this.selectedAttributes +
      'selectedOperands: ' + this.selectedOperands +
      "; searchKeys: " + this.searchKeys);
    this.updateEventTree.emit([
      [this.selectedSpecies],
      [this.selectedClass],
      this.selectedAttributes,
      this.selectedOperands,
      this.searchKeys]);
  }

  onHideSelectionChange(): void {
    if (this.hideSearchPanel === "") {
      this.hideShowButtonLabel = "Show Filters";
      this.hideSearchPanel = "hidden";
    } else {
      this.hideShowButtonLabel = "Hide Panel";
      this.hideSearchPanel = "";
    }
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
    (<HTMLInputElement>document.getElementById("searchKey" + pos)).value = "";
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

  addAttribute() {

  }
}
