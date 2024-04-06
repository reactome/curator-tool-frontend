import { Injectable } from '@angular/core';
import { PostEditOperation } from '../post-edit/PostEditOperation';
import { InstanceNameGenerator } from '../post-edit/InstanceNameGenerator';
import { DataService } from './data.service';
import { Instance } from '../models/reactome-instance.model';

@Injectable({
  providedIn: 'root'
})
export class PostEditService {

  private postEditOperations: PostEditOperation[] = [];

  constructor(private dataService: DataService) { 
    // Make sure display name generation service is at the bottom
    const nameOperation = new InstanceNameGenerator(this.dataService);
    this.postEditOperations.push(nameOperation);
  }

  postEdit(instance: Instance, attributeName: string | undefined) {
    for (let op of this.postEditOperations) {
      op.postEdit(instance, attributeName);
    }
  }

}
