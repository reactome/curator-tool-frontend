import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class DragDropService {
  // @ts-ignore
  dropLists: string[] = [];
  canDrop: boolean = false;

  public register(attributeName: string) {
    // generating an id for each table row. Must cast string as CdkDropList type
    this.dropLists.push('cdk-drop-list-' + attributeName);
  }

  public unregister(attributeName: string) {
    let index = this.dropLists.indexOf('cdk-drop-list-' + attributeName)
    this.dropLists.splice(index, 1);
  }

  public resetList() {
    this.dropLists = [];
  }
}
