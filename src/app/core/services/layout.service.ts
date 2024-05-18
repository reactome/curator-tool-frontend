/**
 * This class is just a placeholder to test that classes in core/graphic-display compile.
 */

import { Injectable } from '@angular/core';
import { HyperEdge } from '../graphic-display/HyperEdge';
import { Instance } from '../models/reactome-instance.model';
import { Store } from '@ngrx/store';

@Injectable({
  providedIn: 'root',
})

export class LayoutService {

  private hyperEdge: HyperEdge;

  constructor(private store: Store) {
    this.hyperEdge = new HyperEdge();
  }
}
