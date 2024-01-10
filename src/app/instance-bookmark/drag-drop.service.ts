import {CdkDropList} from "@angular/cdk/drag-drop";
import {Inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";

@Injectable({
  providedIn: 'root'
})
export class DragDropService {
  dropLists: CdkDropList[] = [];
  currentHoverDropListId?: string;

  public register(attributeName: string) {
    // generating an id for each table row. Must cast string as CdkDropList type
    this.dropLists.push(('cdk-drop-list-' + attributeName) as unknown as CdkDropList);
  }

  public resetList() {
    this.dropLists = [];
  }
}
