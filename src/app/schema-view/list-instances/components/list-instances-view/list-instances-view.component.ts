import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Params } from "@angular/router";
import { InstanceSelectionComponent } from './table/instance-selection.component';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-list-instances-view',
  templateUrl: './list-instances-view.component.html',
  styleUrls: ['./list-instances-view.component.scss'],
})
export class ListInstancesViewComponent implements AfterViewInit {
  schemaClassName: any = "";
  attributes: Array<string> = [];
  attributeTypes: Array<string> = [];
  regex: Array<string> = [];
  searchKey: Array<string> = [];
  queryString: string = '';

  // Get this so that we can manipulate the search criteria directly
  @ViewChild(InstanceSelectionComponent) instanceList!: InstanceSelectionComponent;

  constructor(private route: ActivatedRoute) {
  }

  // Need to use this hooker to ensure instanceList is there always!
  ngAfterViewInit(): void {
    combineLatest([this.route.params, this.route.queryParams]).subscribe(
      ([params, queryParams]) => this.handleRoute(params, queryParams)
    );
  }

  private handleRoute(params: Params, queryParams: Params) {
    console.debug('params: ' + params);
    console.debug('queryParms: ' + queryParams);
    if (params['skip'])
      this.instanceList.skip = params['skip']; // Use whatever is default
    if (params['limit'])
      this.instanceList.pageSize = params['limit'];
    if (queryParams['query']) {
      console.debug('query: ' + queryParams['query']);
      this.instanceList.searchKey = queryParams['query'];
    }
    // Give it a little bit delay to avoid ng0100 error.
    setTimeout(() => {
      this.schemaClassName = params['className'];
    });
    let isChangedChanged = this.instanceList.className !== params['className'];
    this.instanceList.className = params['className'];
    if (queryParams['attributes'] && queryParams['operands'] && queryParams['searchKeys']) { // This is for search
      // Need to get attributes
      let attributes = queryParams['attributes'].split(',');
      let operands = queryParams['operands'].split(',');
      let searchKeys = queryParams['searchKeys'].split(',');
      this.instanceList.searchInstances(attributes, operands, searchKeys);
      this.updateHeader(attributes);

    }
    else
      this.instanceList.loadInstances();
    if (isChangedChanged) // Need to force to reload attributes there.
      this.instanceList.loadSchemaClasses();
  }

  updateHeader($event: string) {
    this.queryString = ' (filter: ' + $event + ')';
  }
}
