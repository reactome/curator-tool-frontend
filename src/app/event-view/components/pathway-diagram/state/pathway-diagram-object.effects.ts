import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { take, tap } from 'rxjs/operators';
import { PathwayDiagramObjectActions } from './pathway-diagram-object.actions';
import { PathwayDiagramObject } from './pathway-diagram-object.model';
import { pathwayDiagramObjects } from './pathway-diagram-object.selectors';

@Injectable()
export class PathwayDiagramObjectEffects {

  constructor(
    private store: Store,
    private actions$: Actions
  ) {
    window.addEventListener('storage', (event) => {
      if (event.key === PathwayDiagramObjectActions.register_pathway_diagram_object.type) {
        const pathwayDiagramObject = this.parseLocalStorageObject(event.newValue);
        this.store.dispatch(PathwayDiagramObjectActions.ls_register_pathway_diagram_object(pathwayDiagramObject as PathwayDiagramObject));
      }
      else if (event.key === PathwayDiagramObjectActions.remove_pathway_diagram_object.type) {
        const pathwayDiagramObject = this.parseLocalStorageObject(event.newValue);
        this.store.dispatch(PathwayDiagramObjectActions.ls_remove_pathway_diagram_object(pathwayDiagramObject as PathwayDiagramObject));
      }
      else if (event.key === PathwayDiagramObjectActions.set_pathway_diagram_objects.type) {
        const pathwayDiagramObjects = this.parseLocalStorageObject(event.newValue);
        this.store.dispatch(PathwayDiagramObjectActions.ls_set_pathway_diagram_objects({ instances: pathwayDiagramObjects as PathwayDiagramObject[] }));
      }
    });
  }

  pathwayDiagramObjectChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          PathwayDiagramObjectActions.register_pathway_diagram_object,
          PathwayDiagramObjectActions.remove_pathway_diagram_object,
          PathwayDiagramObjectActions.reset_pathway_diagram_object,
          PathwayDiagramObjectActions.set_pathway_diagram_objects
        ),
        tap((action) => {
          if (action.type === PathwayDiagramObjectActions.set_pathway_diagram_objects.type) {
            const objects = (action.valueOf() as { instances: PathwayDiagramObject[] }).instances ?? [];
            localStorage.setItem(action.type, JSON.stringify({ object: JSON.stringify(objects), timestamp: Date.now() }));
          }
          else if (action.type === PathwayDiagramObjectActions.reset_pathway_diagram_object.type) {
            localStorage.setItem(action.type, JSON.stringify({ object: JSON.stringify(action.valueOf()), timestamp: Date.now() }));
          }
          else {
            localStorage.setItem(action.type, JSON.stringify({ object: JSON.stringify(action.valueOf()), timestamp: Date.now() }));
          }
          this.store.select(pathwayDiagramObjects()).pipe(take(1)).subscribe(objects => {
            localStorage.setItem(PathwayDiagramObjectActions.get_pathway_diagram_objects.type, JSON.stringify({ object: JSON.stringify(objects), timestamp: Date.now() }));
          });
        })
      ),
    { dispatch: false }
  );

  private parseLocalStorageObject(content: string | null) {
    const value = JSON.parse(content || '{}');
    return JSON.parse(value.object || '[]');
  }
}