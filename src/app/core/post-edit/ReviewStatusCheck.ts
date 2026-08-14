import { Instance, ReviewStatus } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { PostEditListener, PostEditOperation } from "./PostEditOperation";
import { InfoDialogComponent } from "src/app/shared/components/info-dialog/info-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { Inject, inject, Injectable } from "@angular/core";
import { InstanceUtilities } from "../services/instance.service";
import { Observable, catchError, map, of } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class ReviewStatusCheck implements PostEditOperation {
    readonly dialog = inject(MatDialog);

    // The slots holding the InstanceEdits a review has to post-date. structureModified is the
    // subset of modified that changed the structure of the event; it is filled in at the
    // server-side during commit from the isStructureModified flag set below, so it may lag
    // behind modified for edits that have not been committed yet.
    private static readonly MODIFICATION_SLOTS = ['structureModified', 'modified'];

    // Stands in for the dateTime of a review InstanceEdit that has not been committed yet: the
    // server stamps it during commit, which is necessarily later than any dateTime already stored.
    private static readonly NOT_YET_COMMITTED = Number.MAX_SAFE_INTEGER;

    constructor(private dataService: DataService, private utils: InstanceUtilities) {
    }

    postEdit(instance: Instance,
        editedAttributeName: string | undefined,
        postEditListener?: PostEditListener): boolean {

        this.handleReviewStatus(instance, editedAttributeName!, true, postEditListener);
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


    public handleReviewStatus(instance: Instance,
        attributeName: string,
        isActiveEdit: boolean = true,
        postEditListener?: PostEditListener): boolean {
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
                this.promoteReviewStatus(instance, ReviewStatus.threeStar, preStatus, isActiveEdit, postEditListener);
            }
            else if (preStatus?.dbId === ReviewStatus.twoStar.dbId) {
                this.promoteReviewStatus(instance, ReviewStatus.fourStar, preStatus, isActiveEdit, postEditListener);
            }

        }
        else if (this.isExternalReviewedAdded(instance, attributeName)) {
            // ensureReviewStatusInLocal(e.getEditingComponent());
            let preStatus = instance.attributes?.get('reviewStatus');
            if (preStatus === null ||
                preStatus?.dbId === ReviewStatus.twoStar.dbId ||
                preStatus?.dbId === ReviewStatus.threeStar.dbId ||
                preStatus?.dbId === ReviewStatus.fourStar.dbId) {
                this.promoteReviewStatus(instance, ReviewStatus.fiveStar, preStatus, isActiveEdit, postEditListener);
            }
        }
        return reviewStatusChanged;
    }

    /**
     * Apply a promotion of the reviewStatus, but only if the dateTimes behind it hold up (see
     * checkReviewStatusDateTimes). The InstanceEdits in the review and modification slots reach
     * the client as shells, so their dateTimes have to be loaded first, which makes this
     * asynchronous: the promotion lands after handleReviewStatus has already returned and the
     * passed PostEditListener is what gets the view to catch up.
     */
    private promoteReviewStatus(instance: Instance,
        reviewStatus: Instance,
        preStatus: Instance | undefined,
        isActiveEdit: boolean,
        postEditListener: PostEditListener | undefined) {
        this.loadReviewStatusInstanceEdits(instance).subscribe(() => {
            const issues = this.checkReviewStatusDateTimes(instance, reviewStatus);
            if (issues.length > 0) {
                if (isActiveEdit) {
                    this.dialog.open(InfoDialogComponent, {
                        data: {
                            title: 'ReviewStatus Not Promoted',
                            message: 'The reviewStatus has been left at ' +
                                (preStatus?.displayName ?? 'its current value') +
                                ' instead of being promoted to ' + reviewStatus.displayName + ': ' +
                                issues.join(' ') +
                                ' A review has to be dated after the last modification of the instance.',
                        }
                    });
                }
                return;
            }
            instance.attributes.set('previousReviewStatus', preStatus);
            this.addModifiedAttributes('previousReviewStatus', instance, isActiveEdit);
            instance.attributes?.set('reviewStatus', reviewStatus);
            this.addModifiedAttributes('reviewStatus', instance, isActiveEdit);
            postEditListener?.donePostEdit(instance, 'reviewStatus');
        });
    }

    /**
     * This method is used to check if the assignment to the reviewStatus is correct by following the following:
     * 1). Three stars: internalReviewed is assigned. Its datetime is later than the latest datetime of the InstanceEdits
     * in the structureUpdate slot if any.
     * 2). Four stars: both reviewed and internalReviewed are assigned. The latest datatime of the internalReviewed is later
     * than the latest of the reviewed and the latest of the structureUpdate.
     * 3). Five stars: reviewed must be assigned (authored will not be used). Its datetime is later than the latest datetime
     * of the InstanceEdits in the structureUpdate slot if any.
     * For more details, see https://docs.google.com/presentation/d/1Y3fxXS3DzE0aRZmPnE1K6PC51BHd5dak/edit#slide=id.p8.
     * Note: Since one and two stars are not released, they are not checked.
     *
     * The last modification is taken as the later of the structureModified and modified slots, so that a review
     * predating any edit to the instance is caught, not just a structural one.
     *
     * A review InstanceEdit that has just been created has no dateTime yet, and counts as later than the
     * last modification: the server stamps it during commit, after everything already recorded. See
     * getLatestReviewDateTime.
     *
     * Whether a slot is assigned and whether its dateTime can be resolved are kept apart on purpose, since
     * an InstanceEdit whose dateTime cannot be reached is an ordering this check cannot judge, not a
     * missing review. Any comparison it cannot make is skipped rather than treated as a violation, so an
     * unresolvable dateTime never blocks a promotion.
     *
     * @returns the reasons the passed reviewStatus does not hold up; empty if it is consistent.
     */
    public checkReviewStatusDateTimes(instance: Instance, reviewStatus: Instance): string[] {
        const issues: string[] = [];
        const hasInternalReviewed = this.getInstanceEdits(instance, 'internalReviewed').length > 0;
        const hasReviewed = this.getInstanceEdits(instance, 'reviewed').length > 0;
        const latestModified = this.getLatestModificationDateTime(instance);
        const latestInternalReviewed = this.getLatestReviewDateTime(instance, 'internalReviewed');
        const latestReviewed = this.getLatestReviewDateTime(instance, 'reviewed');

        if (reviewStatus.dbId === ReviewStatus.threeStar.dbId) {
            if (!hasInternalReviewed)
                issues.push('internalReviewed is not assigned.');
            else if (latestInternalReviewed !== undefined)
                issues.push(...this.checkIsAfterModification('internalReviewed', latestInternalReviewed, latestModified));
        }
        else if (reviewStatus.dbId === ReviewStatus.fourStar.dbId) {
            if (!hasInternalReviewed)
                issues.push('internalReviewed is not assigned.');
            if (!hasReviewed)
                issues.push('reviewed is not assigned.');
            if (latestInternalReviewed !== undefined) {
                if (latestReviewed !== undefined && latestInternalReviewed < latestReviewed)
                    issues.push('internalReviewed (' + this.formatDateTime(latestInternalReviewed) +
                        ') is not later than reviewed (' + this.formatDateTime(latestReviewed) + ').');
                issues.push(...this.checkIsAfterModification('internalReviewed', latestInternalReviewed, latestModified));
            }
        }
        else if (reviewStatus.dbId === ReviewStatus.fiveStar.dbId) {
            // authored is deliberately not consulted here.
            if (!hasReviewed)
                issues.push('reviewed is not assigned.');
            else if (latestReviewed !== undefined)
                issues.push(...this.checkIsAfterModification('reviewed', latestReviewed, latestModified));
        }
        // One and two stars are not released, so they are not checked.
        return issues;
    }

    private checkIsAfterModification(slotName: string,
        latestReview: number,
        latestModified: number | undefined): string[] {
        if (latestModified !== undefined && latestReview < latestModified)
            return [slotName + ' (' + this.formatDateTime(latestReview) +
                ') is earlier than the last modification (' + this.formatDateTime(latestModified) + ').'];
        return [];
    }

    /**
     * Load the InstanceEdits the dateTime checks need. Attribute values arrive from the server as shells
     * (dbId, displayName and schemaClassName only), so fetching them is what puts their dateTime within
     * reach of getLatestDateTime, via the DataService cache.
     */
    private loadReviewStatusInstanceEdits(instance: Instance): Observable<void> {
        const slots = [...ReviewStatusCheck.MODIFICATION_SLOTS, 'internalReviewed', 'reviewed'];
        const toLoad = new Set<number>();
        for (const slotName of slots) {
            for (const instanceEdit of this.getInstanceEdits(instance, slotName)) {
                // A new InstanceEdit has a negative dbId and no dateTime until it is committed.
                if (instanceEdit.dbId > 0 && this.getDateTime(instanceEdit) === undefined)
                    toLoad.add(instanceEdit.dbId);
            }
        }
        if (toLoad.size === 0)
            return of(undefined); // forkJoin in fetchInstances would never emit for an empty list
        return this.dataService.fetchInstances([...toLoad]).pipe(
            map(() => undefined),
            // Not being able to load an InstanceEdit is not evidence of a bad dateTime, so let the
            // checks proceed and skip whatever they cannot resolve.
            catchError(() => of(undefined))
        );
    }

    /** The InstanceEdits held in a slot, whether it is single or multi valued. */
    private getInstanceEdits(instance: Instance, slotName: string): Instance[] {
        const value = instance.attributes?.get(slotName);
        if (!value)
            return [];
        return (Array.isArray(value) ? value : [value]).filter((val: any) => val?.dbId !== undefined);
    }

    private getDateTime(instanceEdit: Instance): any {
        return instanceEdit.attributes?.get('dateTime') ??
            this.dataService.getCachedInstance(instanceEdit.dbId)?.attributes?.get('dateTime');
    }

    /**
     * The latest dateTime across the slots recording a modification of the instance, or undefined if
     * none of them holds an InstanceEdit with a dateTime that can be resolved and parsed.
     */
    private getLatestModificationDateTime(instance: Instance): number | undefined {
        return this.getLatest(ReviewStatusCheck.MODIFICATION_SLOTS
            .flatMap(slotName => this.getInstanceEdits(instance, slotName))
            .map(instanceEdit => this.parseDateTime(this.getDateTime(instanceEdit))));
    }

    /**
     * The latest dateTime among the InstanceEdits in a review slot, or undefined if the slot is empty or
     * none of its InstanceEdits has a dateTime that can be resolved and parsed.
     *
     * A newly created InstanceEdit counts as the latest rather than as unresolvable: it has no dateTime
     * until the server stamps it at commit, and that stamp is later than every modification already
     * recorded. Note that the same does not hold on the modification side - an uncommitted modification
     * would be stamped at the very same commit, so it is not later than the review being added, which is
     * why getLatestModificationDateTime sticks to dateTimes that are actually there.
     */
    private getLatestReviewDateTime(instance: Instance, slotName: string): number | undefined {
        return this.getLatest(this.getInstanceEdits(instance, slotName)
            .map(instanceEdit => this.parseDateTime(this.getDateTime(instanceEdit)) ??
                (instanceEdit.dbId < 0 ? ReviewStatusCheck.NOT_YET_COMMITTED : undefined)));
    }

    private getLatest(dateTimes: (number | undefined)[]): number | undefined {
        let latest: number | undefined;
        for (const dateTime of dateTimes) {
            if (dateTime !== undefined && (latest === undefined || dateTime > latest))
                latest = dateTime;
        }
        return latest;
    }

    /**
     * Reduce an InstanceEdit's dateTime to a yyyyMMddHHmmss number so that two of them can be compared
     * regardless of the format they are stored in: 20120726202613, 2012-07-26 20:26:13 (MySQL 8) and
     * 2012-07-26 20:26:13.0 are all in use. All of them are in GMT, so no time zone handling is needed.
     * A value missing its time part is taken at the start of the day, which is the earliest it could be.
     */
    private parseDateTime(dateTime: any): number | undefined {
        if (typeof dateTime !== 'string')
            return undefined;
        const digits = dateTime.replace(/\D/g, '');
        if (digits.length < 8)
            return undefined; // Not even a full date
        return Number(digits.substring(0, 14).padEnd(14, '0'));
    }

    private formatDateTime(dateTime: number): string {
        if (dateTime === ReviewStatusCheck.NOT_YET_COMMITTED)
            return 'not yet committed';
        const digits = String(dateTime).padStart(14, '0');
        return digits.substring(0, 4) + '-' + digits.substring(4, 6) + '-' + digits.substring(6, 8) + ' ' +
            digits.substring(8, 10) + ':' + digits.substring(10, 12) + ':' + digits.substring(12, 14);
    }

    addModifiedAttributes(attributeName: string, instance: Instance, isActiveEdit: boolean) {
        if (isActiveEdit) {
            this.utils.addToModifiedAttributes(attributeName, instance);
        } else {
            this.utils.addToPassiveModifiedAttributes(attributeName, instance);
        }
    }
}
