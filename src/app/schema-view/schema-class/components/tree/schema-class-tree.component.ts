import { FlatTreeControl } from "@angular/cdk/tree";
import { Component } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from "@angular/material/tree";
import {Router, ROUTES} from "@angular/router";
import { Store } from "@ngrx/store";
import { SchemaClass } from "../../../../core/models/reactome-schema.model";
import { DataService } from "../../../../core/services/data.service";
import { EDIT_ACTION } from "src/app/instance/components/instance-view/instance-table/instance-table.model";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";

/** Tree node with expandable and level information */
interface SchemaClassNode {
  expandable: boolean;
  name: string;
  level: number;
  count: number;
  abstract: boolean;
}

@Component({
  selector: 'app-schema-class-tree',
  templateUrl: './schema-class-tree.component.html',
  styleUrls: ['./schema-class-tree.component.scss']
})
export class SchemaClassTreeComponent {
  private _transformer = (node: SchemaClass, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      count: node.count ?? 0,
      level: level,
      abstract: node.abstract ?? false, // Default is false
    };
  };

  treeControl = new FlatTreeControl<SchemaClassNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(private service: DataService, private router: Router, private store: Store) {
    service.fetchSchemaClassTree().subscribe(data => {
      this.dataSource.data = [data]
      this.treeControl.expandAll();
    })
  }

  hasChild = (_: number, node: SchemaClassNode) => node.expandable;

  createNewInstance(schemaClassName: string) {
    this.service.createNewInstance(schemaClassName).subscribe(instance => {
      this.service.registerNewInstance(instance);
      this.store.dispatch(NewInstanceActions.register_new_instance(instance));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId]);
    });
  }

  filterData(searchFilters: Array<string[]>, generatePlot?: boolean) {
    let schemaClass: string = "";
    let selectedClass = searchFilters[1][0] as string;
    let selectedAttributes = searchFilters[2];
    let selectedAttributeTypes = searchFilters[3];
    let selectedOperands = searchFilters[4];
    let searchKeys = [];
    if (selectedClass !== "") {
      schemaClass = selectedClass;
    }
    for(let i=0; i<searchFilters[5].length; i++){
      if(searchFilters[5].at(i)?.includes(" ")) {
        console.log('key', searchFilters[5].at(i)?.split(' ')[0])
        searchKeys.push(searchFilters[5].at(i)?.split(' ').join('--'));
      }
      else if(searchFilters[5].at(i) === 'na'){}
      else searchKeys.push(searchFilters[5].at(i));
    }
    console.log('searchKeys', searchKeys);
    let url =  "/schema_view/list_instances/" + schemaClass + "/";
    console.log('params', schemaClass, selectedAttributes, selectedOperands, searchKeys );
    this.router.navigate(["/schema_view/list_instances/", schemaClass,
      selectedAttributes.join(','),
      selectedAttributeTypes.join(','),
      selectedOperands.join(','),
      searchKeys.join(',').toString()])
  }

  protected readonly EDIT_ACTION = EDIT_ACTION;
}

// className: schemaClass,
//   attributes: selectedAttributes,
//   regex: selectedOperands,
//   searchKey: searchKeys
