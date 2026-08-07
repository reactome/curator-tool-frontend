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
    const id = 'cdk-drop-list-' + attributeName;
    // Registration is idempotent: a drop list may be registered again when its component is
    // re-created, and a duplicated id would be resolved twice as a drag sibling.
    if (!this.dropLists.includes(id))
      this.dropLists.push(id);
  }

  public unregister(attributeName: string) {
    let index = this.dropLists.indexOf('cdk-drop-list-' + attributeName)
    if (index < 0) return; // splice(-1, 1) would drop an unrelated, still-registered id
    this.dropLists.splice(index, 1);
  }
}
