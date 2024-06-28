import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {DataService} from "../../../core/services/data.service";
import {AttributeDataType, SchemaAttribute, SchemaClass} from "../../../core/models/reactome-schema.model";
import {NgFor} from "@angular/common";
import {AttributeCondition} from "./attribute-condition/attribute-condition.component";
import {classNames} from "@angular/cdk/schematics";
import {Event, Router} from "@angular/router";

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
export class SearchFilterComponent implements OnInit{
  @Input() set selectedSchemaClass(selectedSchemaClass: string) {
    // To avoid ng100 view change error
    setTimeout(() => {
      this.selectedClass = selectedSchemaClass;
    });
  }
  // Adding flags to use the filter in the schema
  @Input() isSchemaView: boolean = false;
  @Input() set schemaClassAttributes(schemaClassAttributes: string[]){
    this.schemaAttributes = schemaClassAttributes.sort((a, b) => a.localeCompare(b));
  }
  @Input() schemaClassNodes: SchemaClass[] = [];
  @Output() addAttributeCondition: EventEmitter<any> = new EventEmitter();
  // For doing search
  schemaAttributes: string[] = [];
  selectedSpecies = "All";
  selectedClass = "Reaction";
  selectedAttributes: string[] = ["displayName"];
  selectedOperands: string[] = ["Contains"];
  attributeConditions: AttributeCondition[] = [];
  numberOfConditionsToDisplay: number = 1;
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
  hideShowButtonLabel: string = "...";
  hideSearchPanel: string = "hidden";

  constructor(
    private router: Router,
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
      this.schemaAttributes = this.getAttributes(this.selectedClass)!;
    })
  }

  @Output() updateEventTree = new EventEmitter<Array<string[]>>();

  ngOnInit(): void {
    this.addAttribute();
  }

  onSearchSelectionChange(): void {
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
    //this.addAttributeCondition.emit(this.attributeConditions);
    if(this.isSchemaView) {
      let attributes = [];
      let regex = [];
      let searchKeys = [];

      for(let attribute of this.attributeConditions) {
        attributes.push(attribute.attributeName);
        regex.push(attribute.operand);
        searchKeys.push(attribute.searchKey);

      }
      this.router.navigate(["/schema_view/list_instances/" + this.selectedClass,
        {
            attributes: attributes.join(','),
            operands: regex.join(','),
            searchKey: searchKeys.join(',')
          }])
      // this.router.navigate([],
      //   { queryParams: this.attributeConditions, queryParamsHandling: 'merge'
      //   });
    }
  }

  onHideSelectionChange(): void {
    if (this.hideSearchPanel === "") {
      this.hideShowButtonLabel = "...";
      this.hideSearchPanel = "hidden";
    } else {
      this.hideShowButtonLabel = "Hide Panel";
      this.hideSearchPanel = "";
    }
  }

  onClassSelection(): void {
    // Reflect the newly selectedClass's attributes in all 'select attributes' mat-form-fields
    this.schemaAttributes = this.getAttributes(this.selectedClass)!;
    this.cdr.detectChanges();
  }


  getAttributes(className: string): string[] | undefined {
    return this.classToAttributes.get(className);
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
    let index = this.numberOfConditionsToDisplay - 1;
    let blankAttributeCondition: AttributeCondition = new class implements AttributeCondition {
      attributeName: string = "displayName";
      operand: string = "Contains";
      searchKey: string = "";
      index: number = index;
    }
    this.attributeConditions.push(blankAttributeCondition);
    this.numberOfConditionsToDisplay++;
  }

  removeAttribute(attCondition: AttributeCondition) {
    this.attributeConditions.splice(this.attributeConditions.indexOf(attCondition), 1);
    this.numberOfConditionsToDisplay--;
  }

  updateAttributeCondition(attCondition: AttributeCondition) {
    let attribute = this.attributeConditions.at(this.attributeConditions.indexOf(attCondition));
    attribute!.attributeName = attCondition.attributeName;
    attribute!.operand = attCondition.operand;
    attribute!.searchKey = attCondition.searchKey;
    attribute!.index = attCondition.index;

  }
}
