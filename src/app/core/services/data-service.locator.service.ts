import { Injectable } from '@angular/core';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root'
})
/**
 * A locator service to expose the DataService object in places that cannot be injected (e.g. some statements)
 */
export class DataServiceLocatorService {
  private static dataService: DataService;

  static getDataService(): DataService {
    return DataServiceLocatorService.dataService;
  }

  static setDataService(dataService: DataService) {
    DataServiceLocatorService.dataService = dataService;
  }

}
