import {Component, Input, OnInit} from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray} from "@angular/cdk/drag-drop";
import {Instance} from "../../../../core/models/reactome-instance.model";
import {DragDropService} from "../../../drag-drop.service";
import {DataService} from "../../../../core/services/data.service";
import {bookmarkedInstances} from "../../../state/bookmark.selectors";
import {Store} from "@ngrx/store";

@Component({
  selector: 'app-bookmark-list',
  templateUrl: './bookmark-list.component.html',
  styleUrls: ['./bookmark-list.component.scss'],
})
export class BookmarkListComponent implements OnInit{
  bookmarks: Instance[] = [];
  cdkDropGroup: string[] = [];

  constructor(public dragDropService: DragDropService, public dataService: DataService, public store: Store) {
  }

  ngOnInit() {
    this.store.select(bookmarkedInstances()).subscribe((instances: Instance[] | undefined) => {
      if (instances !== undefined) {
        this.bookmarks = instances;
      }
    })
  }

  drop(event: CdkDragDrop<Instance[]>) {
    moveItemInArray(this.bookmarks, event.previousIndex, event.currentIndex);
    let attributeName = event.container.id;
    console.log(attributeName)
  }


  protected readonly DragDropService = DragDropService;
}
