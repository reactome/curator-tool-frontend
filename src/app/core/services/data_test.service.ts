import { Injectable } from "@angular/core";
import { take, concatMap, of } from "rxjs";
import { NewInstanceActions } from "src/app/instance/state/instance.actions";
import { defaultPerson } from "src/app/instance/state/instance.selectors";
import { Instance } from "../models/reactome-instance.model";
import { HttpClient } from "@angular/common/http";
import { Store } from "@ngrx/store";
import { InstanceUtilities } from "./instance.service";
import { Data } from "@angular/router";
import { DataService } from "./data.service";


@Injectable({
    providedIn: 'root'
})
/**
 * This class is used to test data transactions to the database. 
 * It is not used in the application. It is just a utility class for testing purposes.
 */
export class Data_testService {
      constructor(private service: DataService,
        private utils: InstanceUtilities,
        private store: Store,
      ) {}

    /**
     * Create and commit one instance for each concrete schema class in the schema class tree.
     * Returns an Observable of the committed instances.
     * Ensures that defaultPerson is selected before proceeding.
     */
    createAndCommitAllConcreteSchemaClasses(): void {
        this.store.select(defaultPerson()).pipe(take(1)).subscribe(person => {
            if (!person || person.length === 0) {
                console.error('Cannot create instances: defaultPerson is not selected.');
                return;
            }
            this.service.fetchSchemaClassTree(false).pipe(take(1)).subscribe(rootClass => {
                const concreteClassNames = new Set<string>();
                this.service.grepConcreteClasses(rootClass, concreteClassNames);
                concreteClassNames.forEach(className => {
                    this.service.createNewInstance(className).pipe(
                        concatMap((instance: Instance) => {
                            instance.attributes.set('displayName', `Test ${className}`);
                            this.service.registerInstance(instance);
                            this.store.dispatch(NewInstanceActions.register_new_instance(this.utils.makeShell(instance)));
                            return of(instance); // Return the instance for the next step
                            // return this.commit(instance);
                        })
                    ).subscribe({
                        next: (committedInstance) => {
                            console.log(`Successfully created and committed instance of ${className} with dbId ${committedInstance.dbId}`);
                        },
                        error: (error) => {
                            console.error(`Failed to create and commit instance of ${className}:`, error);
                        }
                    });
                });
            });
        });
    }
}