import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {PageEvent} from "@angular/material/paginator";
import {MatTableDataSource} from "@angular/material/table";
import {Instance} from "../../../../../core/models/reactome-instance.model";
import {DataService} from "../../../../../core/services/data.service";
import {ViewOnlyService} from "../../../../../core/services/view-only.service";
import {ActivatedRoute, Router} from "@angular/router";
import {AttributeCondition} from '../../../../../core/models/reactome-instance.model';
import {ReferrersDialogService} from "../../../../../instance/components/referrers-dialog/referrers-dialog.service";
import {DeletionDialogService} from "../../../../../instance/components/deletion-dialog/deletion-dialog.service";

@Component({
  selector: 'app-instance-selection',
  templateUrl: './instance-selection.component.html',
  styleUrls: ['./instance-selection.component.scss'],
})
export class InstanceSelectionComponent implements OnInit {
  skip: number = 0;
  // For doing search
  searchKey: string | undefined = '';
  advancedSearchKey: string | undefined = '';
  pageSizeOptions = [20, 50, 100];
  @Input() pageSize: number = 50;
  pageIndex: number = 0;
  className: string = "";
  instanceCount: number = 0;
  selected: number = 0; //move
  showProgressSpinner: boolean = true;
  @Output() clickEvent = new EventEmitter<Instance>();
  @Input() isSelection: boolean = false;
  data: Instance[] = [];
  actionButtons: string[] = ["launch", "delete", "list_alt"];
  // schemaClasses: SchemaClass[] = [];
  schemaClassAttributes: string[] = [];
  // A flag to use route to load: use string so that we can set it directly in html
  @Input() useRoute: boolean = false;
  showFilterComponent: boolean = false;

  // TODO: There is NG0100 error here: ExpressionChagnedAfterCheckingError. setTimeOut fix cannot work here!!!
  @Input() set setClassName(inputClassName: string) {
    this.className = inputClassName;
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
    this.loadSchemaClasses();
  }

  constructor(private dataService: DataService,
              private router: Router,
              private route: ActivatedRoute,
              private referrersDialogService: ReferrersDialogService,
              private deletionDialogService: DeletionDialogService) {
  }

  ngOnInit(): void {
    this.skip = 0;
    this.pageIndex = 0;
    this.showProgressSpinner = true;
    this.loadInstances();
    this.loadSchemaClasses();
    console.log('data', this.data)
  }

  loadInstances() {
    // Make sure className is set!
    if (this.className && this.className.length > 0) {
      this.dataService.listInstances(this.className, this.skip, this.pageSize, this.searchKey)
        .subscribe((instancesList) => {
            this.instanceCount = instancesList.totalCount;
            this.showProgressSpinner = false;
            this.data = instancesList.instances;
          }
        )
    }
  }

  loadSchemaClasses() {
    if (this.className && this.className.length > 0) {
      this.dataService.fetchSchemaClass(this.className).subscribe(cls => {
        if (cls && cls.attributes) {
          // Make a copy and then sort
          let attributes = [...cls.attributes];
          attributes.sort((a, b) => a.name.localeCompare(b.name));
          this.schemaClassAttributes.length = 0; // Empty it first
          attributes.forEach(attr => {
            this.schemaClassAttributes.push(attr.name);
          });
        }
      });
    }
  }

  searchForName(_: Event | undefined) {
    this.skip = 0;
    this.pageIndex = 0;
    if (this.useRoute) {
      let url = '/schema_view/list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
      if (this.searchKey && this.searchKey.trim().length > 0) // Here we have to use merge to keep all parameters there. This looks like a bug in Angular!!!
        this.router.navigate([url], {queryParams: {query: this.searchKey.trim()}, queryParamsHandling: 'merge'});
      else
        this.router.navigate([url]);
    } else
      this.loadInstances();
  }

  onPageChange(pageObject: PageEvent) {
    this.skip = pageObject.pageIndex * pageObject.pageSize;
    this.pageSize = pageObject.pageSize;
    this.pageIndex = pageObject.pageIndex;
    this.loadInstances();
  }

  onRowClick(row: Instance) {
    this.selected = row.dbId
    this.clickEvent.emit(row)
  }

  handleAction(actionEvent: { instance: Instance, action: string }) {
    switch (actionEvent.action) {
      case "launch": {
        const dbId = actionEvent.instance.dbId;
        window.open(`schema_view/instance/${dbId}?${ViewOnlyService.KEY}=true`, '_blank');
        break;
      }
      case "delete": {
        this.deletionDialogService.openDialog(actionEvent.instance);
        break;
      }
      case "list_alt": {
        this.referrersDialogService.openDialog(actionEvent.instance);
        break;

      }
    }
  }

  /**
   * Search instances based on a set of search criteria.
   * @param attributeNames
   * @param operands
   * @param searchKeys
   */
  searchInstances(attributeNames: string[],
                  operands: string[],
                  searchKeys: string[]
  ) {
    this.showProgressSpinner = true;
    this.dataService.searchInstances(this.className, this.skip, this.pageSize, attributeNames, operands, searchKeys)
      .subscribe(instanceList => {
        this.instanceCount = instanceList.totalCount;
        this.data = instanceList.instances;
        this.showProgressSpinner = false;
      })
  }

  /**
   * Handle the search button action.
   * @param searchFilters
   */
  searchAction(attributeCondition: AttributeCondition) {
    this.advancedSearchKey += "("
      + attributeCondition.attributeName
      + "[" + attributeCondition.operand
      + ": " + attributeCondition.searchKey + "])";
  }

  /**
   * Check if the provided search condition is valid.
   * @param attribuateCondition
   */
  private isValidSearchCondition(attribuateCondition: AttributeCondition) {
    if (attribuateCondition.attributeName === undefined || attribuateCondition.attributeName === null)
      return false;
    // For operands that are not related to null, the search key must be provided
    if (!attribuateCondition.operand.toLocaleLowerCase().includes('null')) {
      const key = attribuateCondition.searchKey;
      if (key === undefined || key === null || key.trim().length === 0)
        return false;
    }
    return true;
  }

  showFilter() {
    this.showFilterComponent = !this.showFilterComponent;
  }

  advancedSearch($event: any) {
    // let attributeNames: string = '';
    // let operands: string;
    // let searchKeys: string;
    // //for(let attributeCondition of searchFilters) {
    // //   if (!this.isValidSearchCondition(attributeCondition))
    // //     continue;
    // attributeNames = attributeCondition.attributeName;
    // // Do a little bit map
    // let operand = attributeCondition.operand;
    // operand = operand.replaceAll(' ', '_').toLocaleLowerCase();
    // operands = operand;
    // // Push something to make the server happy
    // if (operand.includes('null'))
    //   searchKeys = 'na'; // Just something that is not used at all.
    // else
    //   searchKeys = attributeCondition.searchKey;
    // this.advancedSearchKey += attributeCondition.attributeName + " " + attributeCondition.operand + " " + attributeCondition.searchKey;
    // // }
    //
    // if (attributeNames === '')
    //   return; // Nothing to do. No valid attribute condition found!
    // if (this.useRoute) {
    //   //   let url = '/schema_view/list_instances/' + this.className + '/' + this.skip + '/' + this.pageSize;
    //   //   let queryParams = {
    //   //     attributes: attributeNames.join(','),
    //   //     operands: operands.join(','),
    //   //     searchKeys: searchKeys.join(',')
    //   //   }
    //   //   this.router.navigate([url], {queryParams: queryParams, queryParamsHandling: 'merge'});
    //   // }
    //   //else
    //   //this.searchInstances(attributeNames, operands, searchKeys);
    // }
  }
}
