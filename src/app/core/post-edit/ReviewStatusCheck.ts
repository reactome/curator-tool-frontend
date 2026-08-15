import { Instance, ReviewStatus } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { PostEditListener, PostEditOperation } from "./PostEditOperation";
import { InfoDialogComponent } from "src/app/shared/components/info-dialog/info-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { Inject, inject, Injectable } from "@angular/core";
import { InstanceUtilities } from "../services/instance.service";

/**
 * The following text is copied from the Java Desktop version of Reactome Curator Tool. It is used to check if the review status of an instance needs to be updated after an edit operation.
 *
 *
 * This class is used to check if the assignment to the reviewStatus is correct by following the following:
 * 1). Three stars: internalReviewed is assigned. Its datetime is later than the latest datetime of the InstanceEdits
 * in the structureUpdate slot if any.
 * 2). Four stars: both reviewed and internalReviewed are assigned. The latest datatime of the internalReviewed is later
 * than the latest of the reviewed and the latest of the structureUpdate.
 * 3). Five stars: reviewed must be assigned (authored will not be used). Its datetime is later than the latest datetime
 * of the InstanceEdits in the structureUpdate slot if any.
 * For more details, see https://docs.google.com/presentation/d/1Y3fxXS3DzE0aRZmPnE1K6PC51BHd5dak/edit#slide=id.p8.
 * Note: Since one and two stars are not released, they are not checked.
 *
 */
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


    public handleReviewStatus(instance: Instance, attributeName: string, isActiveEdit: boolean = true): boolean {
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
                this.addModifiedAttributes('previousReviewStatus', instance, isActiveEdit);

                instance.attributes?.set('reviewStatus', ReviewStatus.oneStar);
                this.addModifiedAttributes('reviewStatus', instance, isActiveEdit);
                if (isActiveEdit === undefined || isActiveEdit) {
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
                this.addModifiedAttributes('previousReviewStatus', instance, isActiveEdit);

                instance.attributes?.set('reviewStatus', ReviewStatus.twoStar);
                this.addModifiedAttributes('reviewStatus', instance, isActiveEdit);

                if (isActiveEdit === undefined || isActiveEdit) {
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
                this.addModifiedAttributes('previousReviewStatus', instance, isActiveEdit);

                instance.attributes?.set('reviewStatus', ReviewStatus.threeStar);
                this.addModifiedAttributes('reviewStatus', instance, isActiveEdit);

            }
            else if (preStatus?.dbId === ReviewStatus.twoStar.dbId) {
                instance.attributes.set('previousReviewStatus', preStatus);
                this.addModifiedAttributes('previousReviewStatus', instance, isActiveEdit);
                instance.attributes?.set('reviewStatus', ReviewStatus.fourStar);
                this.addModifiedAttributes('reviewStatus', instance, isActiveEdit);
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
                this.addModifiedAttributes('previousReviewStatus', instance, isActiveEdit);
                instance.attributes?.set('reviewStatus', ReviewStatus.fiveStar);
                this.addModifiedAttributes('reviewStatus', instance, isActiveEdit);
                reviewStatusChanged = true;
            }
        }
        return reviewStatusChanged;
    }

    addModifiedAttributes(attributeName: string, instance: Instance, isActiveEdit: boolean) {
        if (isActiveEdit) {
            this.utils.addToModifiedAttributes(attributeName, instance);
        } else {
            this.utils.addToPassiveModifiedAttributes(attributeName, instance);
        }
    }
}
