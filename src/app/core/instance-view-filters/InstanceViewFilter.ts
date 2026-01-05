import { Observable } from "rxjs";
import { Instance } from "../models/reactome-instance.model";

/**
 * This is an interface providing a contract for performing pre-processing action (e.g. merge local edits and/or passive vs active edits,
 */
export interface InstanceViewFilter  {
    /**
     * Perform a pre-processing action.
     * @param instance the instance to be filtered (e.g. reviewStatus check, merge local edits, etc)
     * @returns an instance with appropriate visual filters applied for instance view display.
     */
    filter(instance: Instance): Observable<Instance>;
}
