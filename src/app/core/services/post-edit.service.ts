import { Injectable } from '@angular/core';
import {
  PostEditListener,
  PostEditOperation,
} from '../post-edit/PostEditOperation';
import { InstanceNameGenerator } from '../post-edit/InstanceNameGenerator';
import { DataService } from './data.service';
import { Instance } from '../models/reactome-instance.model';
import { LiteratureReferenceFiller } from '../post-edit/LiteratureReferenceFiller';
import { Store } from '@ngrx/store';
import { InstanceUtilities } from './instance.service';
import { ReviewStatusCheck } from '../post-edit/ReviewStatusCheck';
import { MatDialog } from '@angular/material/dialog';
import { ReferenceSequenceAutoFiller } from '../post-edit/ReferenceSequenceAutoFiller';
import { ExternalOntologyFiller } from '../post-edit/ExternalOntologyFiller';
import { ChEBIAutoFiller } from '../post-edit/ChEBIAutoFiller';

@Injectable({
  providedIn: 'root',
})
export class PostEditService {
  private postEditOperations: PostEditOperation[] = [];

  constructor(private dataService: DataService, private store: Store, private utilities: InstanceUtilities, private dialog: MatDialog) {
    // auto filling for reference
    const lrFiller: LiteratureReferenceFiller = new LiteratureReferenceFiller(
      this.dataService,
      this.store,
      this.utilities,
      this.dialog
    );
    this.postEditOperations.push(lrFiller);
    const externalOntologyFiller: ExternalOntologyFiller = new ExternalOntologyFiller(
      this.dataService,
      this.store,
      this.utilities,
      this.dialog
    );
    this.postEditOperations.push(externalOntologyFiller);
    const refFiller: ReferenceSequenceAutoFiller = new ReferenceSequenceAutoFiller(
      this.dataService,
      this.store,
      this.utilities,
      this.dialog
    );
    this.postEditOperations.push(refFiller);
        const chebiFiller: ChEBIAutoFiller = new ChEBIAutoFiller(
      this.dataService,
      this.store,
      this.utilities,
      this.dialog
    );
    this.postEditOperations.push(chebiFiller);
    // Make sure display name generation service is at the bottom
    const nameOperation = new InstanceNameGenerator(this.dataService, this.utilities);
    this.postEditOperations.push(nameOperation);
    const reviewStatusCheck = new ReviewStatusCheck(this.dataService, this.utilities);
    this.postEditOperations.push(reviewStatusCheck);
  }

  postEdit(
    instance: Instance,
    attributeName: string | undefined,
    postEditListener: PostEditListener | undefined
  ) {
    for (let op of this.postEditOperations) {
      op.postEdit(instance, attributeName, postEditListener);
    }
  }
}
