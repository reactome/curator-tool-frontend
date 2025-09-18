import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Route, Router } from "@angular/router";
import { InstanceSelectionComponent } from '../table/instance-selection.component';
import { combineLatest } from 'rxjs';
import { SearchCriterium } from 'src/app/core/models/reactome-instance.model';

@Component({
  selector: 'app-list-instances-view',
  templateUrl: './instance-list-view.component.html',
  styleUrls: ['./instance-list-view.component.scss'],
})
export class InstanceListViewComponent implements AfterViewInit {
  schemaClassName: any = "";
  attributes: Array<string> = [];
  attributeTypes: Array<string> = [];
  regex: Array<string> = [];
  searchKey: Array<string> = [];
  isLocal: boolean = false;

  // Get this so that we can manipulate the search criteria directly
  @ViewChild(InstanceSelectionComponent) instanceList!: InstanceSelectionComponent;

  constructor(private route: ActivatedRoute
  ) {
  }

  // Need to use this hooker to ensure instanceList is there always!
  ngAfterViewInit(): void {
    // Delay to avoid the 'NG0100: ExpressionChangedAfterItHasBeenChecked' error
    setTimeout(() => {
    combineLatest([this.route.params, this.route.queryParams]).subscribe(
      ([params, queryParams]) => this.handleRoute(params, queryParams)
    );
    })
  }

  private handleRoute(params: Params, queryParams: Params) {
    if(params['source'] && params['source'] === 'local') {
      this.instanceList.isLocal = true;
    } else {
      this.instanceList.isLocal = false;
    }
    if (params['skip'])
      this.instanceList.skip = params['skip']; // Use whatever is default
    if (params['limit'])
      this.instanceList.pageSize = params['limit'];
    if (queryParams['query']) {
      console.debug('query: ' + queryParams['query']);
      this.instanceList.searchKey = queryParams['query'];
    }
    // Give it a little bit delay to avoid ng0100 error.
    this.schemaClassName = params['className'];
    let isChangedChanged = this.instanceList.className !== params['className'];
    this.instanceList.className = params['className'];
    if (queryParams['attributes'] && queryParams['operands'] && queryParams['searchKeys']) { // This is for search
      // Need to get attributes
      let attributes = queryParams['attributes'].split(',');
      let operands = queryParams['operands'].split(',');
      let searchKeys = queryParams['searchKeys'].split(',');
      this.instanceList.resetSearchCriteria();
      for (let i = 0; i < attributes.length; i++) {
        const criterium: SearchCriterium = {
          attributeName: attributes[i],
          operand: operands[i],
          searchKey: searchKeys[i] == 'null' ? '' : searchKeys[i]
        };
        this.instanceList.addSearchCriterium(criterium);
      }
      this.instanceList.needAdvancedSearch = true;
      // disable use route for the time being
      const useRoute = this.instanceList.useRoute;
      this.instanceList.useRoute = false; // Regardless the original value, we need to turn it off
      this.instanceList.doAdvancedSearch(this.instanceList.skip);
      this.instanceList.useRoute = useRoute; // set it back
    }
    else
      this.instanceList.loadInstances();
    if (isChangedChanged) // Need to force to reload attributes there.
      this.instanceList.loadSchemaClasses();
  }

}
