/**
 * A simple state manager for selected instances in the instance selection component.
 */

import { Instance } from "src/app/core/models/reactome-instance.model";

export class InstanceSelectionService {
    private selectedInstances: Instance[] = [];
    private static _service: InstanceSelectionService = new InstanceSelectionService();

    // Singleton pattern
    private constructor() {
        if (InstanceSelectionService._service) {
            return InstanceSelectionService._service;
        }
        InstanceSelectionService._service = this;
    }


    public static getService(): InstanceSelectionService
    {
        return InstanceSelectionService._service;
    }

    getSelectedInstances(): Instance[] {
        return this.selectedInstances;
    }

    setSelectedInstances(instances: Instance[]): void {
        this.selectedInstances = instances;
    }

    clearSelectedInstances(): void {
        this.selectedInstances = [];
    }

    addSelectedInstance(instance: Instance): void {
        if (!this.selectedInstances.find(inst => inst.dbId === instance.dbId)) {
            this.selectedInstances.push(instance);
        }
    }

    removeSelectedInstance(instance: Instance): void {
        this.selectedInstances = this.selectedInstances.filter(inst => inst.dbId !== instance.dbId);
    }

    isInstanceSelected(instance: Instance): boolean {
        return this.selectedInstances.some(inst => inst.dbId === instance.dbId);
    }
}