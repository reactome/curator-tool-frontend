import { Injectable } from '@angular/core';
import { PostEditListener, PostEditOperation } from '../post-edit/PostEditOperation';
import { InstanceNameGenerator } from '../post-edit/InstanceNameGenerator';
import { DataService } from './data.service';
import { Instance } from '../models/reactome-instance.model';
import { LiteratureReferenceFiller } from '../post-edit/LiteratureReferenceFiller';
import { Store } from '@ngrx/store';

@Injectable({
  providedIn: 'root'
})
export class PostEditService {

  private postEditOperations: PostEditOperation[] = [];

  constructor(private dataService: DataService,
              private store: Store) { 
    // auto filling for reference
    const lrFiller: LiteratureReferenceFiller = new LiteratureReferenceFiller(this.dataService, this.store);
    this.postEditOperations.push(lrFiller);
    // Make sure display name generation service is at the bottom
    const nameOperation = new InstanceNameGenerator(this.dataService);
    this.postEditOperations.push(nameOperation);
  }

  postEdit(instance: Instance, 
           attributeName: string | undefined,
           postEditListener: PostEditListener | undefined) {
    for (let op of this.postEditOperations) {
      op.postEdit(instance, 
        attributeName,
        postEditListener);
    }
  }

}
