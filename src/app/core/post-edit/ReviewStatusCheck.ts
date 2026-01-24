import { AttributeValue } from "src/app/instance/components/instance-view/instance-table/instance-table.model";
import { Instance, ReviewStatus } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { PostEditListener, PostEditOperation } from "./PostEditOperation";
import { InfoDialogComponent } from "src/app/shared/components/info-dialog/info-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { Inject, inject, Injectable } from "@angular/core";
import { InstanceUtilities } from "../services/instance.service";

@Injectable({
    providedIn: 'root'
})
export class ReviewStatusCheck implements PostEditOperation {
    readonly dialog = inject(MatDialog);

    constructor(private dataService: DataService, private utils: InstanceUtilities) {
    }

    postEdit(instance: Instance,
        editedAttributeName: string | undefined): boolean {

        this.handleReviewStatus(instance, editedAttributeName!);
        return true;
    }

    // Check if the instance is of type Event and if the attributeValue is a structural attribute change 
    // copy the InstanceEdit from the modified slot to the structureModified slot

    private isAttributeStructuralChange(instance: Instance, attributeName: string): boolean {
        // If there is no attribute name, assume not a structural update
        // All attributes added are of instance type which can be either add, remove, or replace
        //  (add and remove) so we do not need to check the action type like Java Desktop version.
        if (attributeName == null)
            return false;
        if (this.utils.isSchemaClass(instance, "Pathway", this.dataService)) {
            if (attributeName === "hasEvent") {
                return true;
            }
            return false;
        }

        else if (this.utils.isSchemaClass(instance, "ReactionLikeEvent", this.dataService)) {
            if (attributeName === "catalystActivity" ||
                attributeName === "regulatedBy" ||
                attributeName === "input" ||
                attributeName === "output")
                return true;
            return false;
        }
        else
            return false;
    }

    private isInternalReviewedAdded(instance: Instance, attributeName: string): boolean {
        if (this.dataService.isEventClass(instance.schemaClass?.name!)) {
            if (attributeName === "internalReviewed") {
                return true;
            }
        }
        return false;
    }

    private isExternalReviewedAdded(instance: Instance, attributeName: string): boolean {
        if (this.dataService.isEventClass(instance.schemaClass?.name!)) {
            if (attributeName === "reviewed") {
                return true;
            }
        }
        return false;
    }

    public checkChangeReviewStatus(instance: Instance, attributeName: string): boolean {
        if (this.isAttributeStructuralChange(instance, attributeName) ||
            this.isInternalReviewedAdded(instance, attributeName) ||
            this.isExternalReviewedAdded(instance, attributeName)) {
            return true;
        }
        return false;
    }


    public handleReviewStatus(instance: Instance, attributeName: string, showDialog?: boolean): boolean {
        let reviewStatusChanged = false;
        if (this.isAttributeStructuralChange(instance, attributeName)) {
            // Regardless of review status, mark structure modified
            instance.isStructureModified = true;
            let reviewStatus = instance.attributes?.get('reviewStatus');

            if (reviewStatus === undefined || reviewStatus.dbId === ReviewStatus.oneStar.dbId || reviewStatus.dbId === ReviewStatus.twoStar.dbId) {
                return false; // do nothing, review status for one and two stars are handled internally 
            }

            // Structural changes for a three star review should be demoted to a one star review status 
            if (reviewStatus.dbId === ReviewStatus.threeStar.dbId) {
                instance.attributes.set('previousReviewStatus', reviewStatus);
                instance.attributes?.set('reviewStatus', ReviewStatus.oneStar);
                if(showDialog === undefined || showDialog) {
                    this.dialog.open(InfoDialogComponent, {
                        data: {
                            title: 'ReviewStatus Demoted',
                            message: 'Your edit changes the structure of the event instance. The reviewStatus has been demoted.',
                        }
                    });
                }
                reviewStatusChanged = true;
            }

            // structural changes for four and five star reviews should be demoted to a two star review status
            if (reviewStatus.dbId === ReviewStatus.fourStar.dbId || reviewStatus.dbId === ReviewStatus.fiveStar.dbId) {
                instance.attributes.set('previousReviewStatus', reviewStatus);
                instance.attributes?.set('reviewStatus', ReviewStatus.twoStar);
                if(showDialog === undefined || showDialog) {
                    this.dialog.open(InfoDialogComponent, {
                        data: {
                            title: 'ReviewStatus Demoted',
                            message: 'Your edit changes the structure of the event instance. The reviewStatus has been demoted.',
                        }
                    });
                }
                reviewStatusChanged = true;
            }
        }

        else if (this.isInternalReviewedAdded(instance, attributeName)) {
            // ensureReviewStatusInLocal(e.getEditingComponent());
            let preStatus = instance.attributes?.get('reviewStatus');
            if (preStatus === null ||
                preStatus?.dbId === ReviewStatus.oneStar.dbId) {
                instance.attributes.set('previousReviewStatus', preStatus);
                instance.attributes?.set('reviewStatus', ReviewStatus.threeStar);
            }
            else if (preStatus?.dbId === ReviewStatus.twoStar.dbId) {
                instance.attributes.set('previousReviewStatus', preStatus);
                instance.attributes?.set('reviewStatus', ReviewStatus.fourStar);
                reviewStatusChanged = true;
            }

        }
        else if (this.isExternalReviewedAdded(instance, attributeName)) {
            // ensureReviewStatusInLocal(e.getEditingComponent());
            let preStatus = instance.attributes?.get('reviewStatus');
            if (preStatus === null ||
                preStatus?.dbId === ReviewStatus.twoStar.dbId ||
                preStatus?.dbId === ReviewStatus.threeStar.dbId ||
                preStatus?.dbId === ReviewStatus.fourStar.dbId) {
                instance.attributes.set('previousReviewStatus', preStatus);
                instance.attributes?.set('reviewStatus', ReviewStatus.fiveStar);
            }
        }
        return reviewStatusChanged;
    }
}
