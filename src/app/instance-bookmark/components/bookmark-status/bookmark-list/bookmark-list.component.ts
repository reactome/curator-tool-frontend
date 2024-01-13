import {Component, Input} from '@angular/core';
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {Instance} from "../../../../core/models/reactome-instance.model";
import {DragDropService} from "../../../drag-drop.service";
import {Store} from "@ngrx/store";

@Component({
  selector: 'app-bookmark-list',
  templateUrl: './bookmark-list.component.html',
  styleUrls: ['./bookmark-list.component.scss'],
})
export class BookmarkListComponent {
  @Input() bookmarks: Instance[] = [];
  cdkDropGroup: string[] = [];

  constructor(public dragDropService: DragDropService) {
  }

  drop(event: CdkDragDrop<Instance[]>) {
    moveItemInArray(this.bookmarks, event.previousIndex, event.currentIndex);
  }

  protected readonly DragDropService = DragDropService;
}
