import {Component, Input} from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray} from "@angular/cdk/drag-drop";
import {Instance} from "../../../core/models/reactome-instance.model";
import {DragDropService} from "../../drag-drop.service";

@Component({
  selector: 'app-bookmark-list',
  templateUrl: './bookmark-list.component.html',
  styleUrls: ['./bookmark-list.component.scss'],
})
export class BookmarkListComponent {
  @Input() bookmarks: Instance[] = [];
  connectedTo: CdkDropList[] = [];

  constructor(dragDropService: DragDropService) {
    this.connectedTo = dragDropService.dropLists
    console.log("connectTo: " + this.connectedTo)
  }

  drop(event: CdkDragDrop<Instance[]>) {
    moveItemInArray(this.bookmarks, event.previousIndex, event.currentIndex);
  }

  protected readonly DragDropService = DragDropService;
}
