#### Bugs:
- The autoscroll for the instance view in the event view scroll the whole instance view. But we need to scroll the table content only just like in the schemw view. (some fixed, but not fully ideal)
- go to pathway in the diagram sometimes has weird selection: the pathway selected is stuck in the URL!
- resizing the nodes cannot change the height of the background for selection. However, sometimes it does work!
- the order inner and outer layers of a compartment needs to be controlled. It is quite random right now.
- Bug: the connecting positions are not updated for helper nodes when they are dragged during editing. (??)
- Bug: inner shapes are not updated when resizing nodes.
- Bug (fixed. Kept for future test): When a PE is used as both input and catalyst, enable/disable editing in pathway diagram cannot recovers the original diagram (input or catalyst may get lost, e.g. http://localhost:4200/event_view/instance/453279?select=8848436) - Bug: LLM geneates text for ALDOB having the original template [PMID: 123456] that is not replaced. See Peter's email on Nov 13, 2024.
- NOTE: for deletion confirmation we need to get the referrers for an instance before determining if the first dialog should show or the second. Therefore, we have decided to keep the first dialog with "no referrers to show" to avoid performing this action before necessary as getting referrers is a heavy transaction. 10/24/25

#### Deidre
- TODO: Use the new set of Reactome icons at Figma, designed by the EBI team. Need to check with Eliott.
- Bug: In the event view, the mouse position is lowed when scroll up/down the instance view. (low priority)
- TODO: Boolean sliders appear to be 'false' when they are 'true' and disabled due to the gray styling for disabled buttons.
- TODO: in the attribute table, attributes may be sorted based on names or define attributes (together with name). Could we make the option sticky: Once the user chooses one sort, the same sort will be applied to all tables opened from that point on. Also it would be nicer to keep the option persisted as the status (for new, updated, etc).
-Bug: tooltip in event view for switching to the schema view is wrong
- "((1,6)-alpha-glucosyl)poly((1,4)-alpha-glucosyl)glycogenin => poly{(1,4)-alpha-glucosyl} glycogenin + alpha-D-glucose" search field for this complicated
    display name cannot be parsed because of symbols
- Refresh of updated list (occured after resetting deleted insts) 
- Bug: Open http://localhost:4200/schema_view/instance/9947940, delete an Input (e.g. the second one), and then open its summation (DB_ID: 9947864). Check its reference should show this reaction at least. However, no reference is shown. This doesn't happen if the edit is reset.
- Bug: Open http://localhost:4200/schema_view/instance/874079. Open its input and then delete this input in the view. There are two bugs: 1). the input itself should not be editable since it is deleted. Yes for attributes having values. But for empty attributes (e.g. reactionType), editing is still enabled; 2). Deleting this input results a passive editing to both reviewStatus and previousReviewStatus. However, these two attributes are recorded as active edited attributes.
- Map the source instance index to the local instance, and check this will work for DnD
- Bug: http://localhost:4200/schema_view/instance/9008456. This BlackBoxEvent has a regulationReference, which has a very long displayName and displayed at more than one line. Put your mouse onto this regulation reference instance. Only the first line is highlighted with a block. It is supposed to have all lines blocked (wrapped by a rectangle defined by CSS).
- TODO: Write a script or manually try to create an object for each concrete class and then upload them. This is to test if all new instances can be saved.
- TODO: During the comparison model, if the code finds a modified attribute is not changed (e.g. _displayName after reset), remove this attribute from the modified array.
- Bug: The referrer dialog should not have the structural change warning (red text) when the referrers are shown not for deletion (low priority). However, if the user just wants to see the instance's referrers, why do we need to check structural changes? This may have some perfornace overhead.

#### TODO:
- bug: the layers of compartment are not right now. Some compartments cannot get selected: http://localhost:4200/event_view/instance/157858, inside compartments, caused by the order of plotting compartments. This needs to be fixed.
- TODO: Set the color of icons in the event tree for dark mode. Right now, they are all black, which cannot be seen in the dark mode.
- For Figure instance: add a customized view to display the figure
- for no-instance edit, press return should commit the change. Control-return should add a new line. (now control+return commits the change)
- pathway diagram: deletion of a reaction in the diagram should delete that reaction. This applies to other object (e.g. a PE that is linked to a reaction).
- stoichioemtry update has not done yet for diagram update after instance editing.
- Add a check for event tree to see if there is any circular reference
- resize: need to make sure all associate attachments (e.g. modification, resizing widgets can be moved around).
- compartment id: since the same compartment can be added multiple times, therefore, we need a central way to manage id
- TODO: Better to come with a new implmenetation of finding all paths between two nodes instea of hacking the code for using aStar in hyperEdge.ts (enableRoundSegments and enableRoundSegmentsForFlowLine)
- TODO: Add a check for circular reference (e.g. precedingEvent): this should be avoided in any case!
- TODO: Check all code to make sure subscriptions are removed when a component is destroyed.
- TODO: Add an IE to referrers for the deleted instance at the server-side, return this IE so that we can manually add it to the local loaded referrers, including updated and deleted instances.
- TODO: When a data service's query method is called via subscribe, the generated subscription cannot be subsribed autmoatically. Make sure use take(1) or manually unscribte it: https://devzilla.io/manage-rxjs-subscriptions-in-angular
- TODO: When a reaction is marked for deleted, this reaction in the diagram should be removed too. However, this may be difficult to handle since the reaction may not be displayed. Therefore, we will need some validation step to validate deleted or updated objects like this as in the Java curator tool.
- TODO: Need to disable the drag of nodes and edges in the legdend for the diagram view.
- TODO: doRelease in the event view has not been handled yet
- TODO: Update a PE or Event with stable identifier after changing the species should update its stable identifier. Right now it works fine at the server-side. However, the front-end has not updated the display yet.
- Merge two instances 
- This is more like a server side bug: When a stable identifier's display name is updated, its local version (front-end) is not updated. This needs to be changed.
- TODO: change input/output or other may cause structure change and demoted the review status. However, reset the change will not reset the changed review status. Also a structureChanged flag is stuck, which results a new structureEdit value. This may need to be udpated in the future.


# Deletion related document kept here for the time being
 * The following may need to be collected into some document for test cases in the doc folder:
 * Expected behavior of deleting an instance:
 * 1). There are two steps of deletion: 1). Local deletion 2). Commit the deletion to the server: the instance is removed
 * at the database
 * 2). Local deleltion: Mark the instance is deleted. This instance can still be viewed, but cannot be selected as an attribute value
 * 3). Commit the deletion to the database: The instance cannot be viewed anymore, and of course cannot be used.
 * 4). When an instance is marked for deletion (Step 1), the following should happen:
 * 4.1). The instance is listed in the deleteInstances list in the store
 * 4.2). The instance should be removed from displayed instance's attributes if it is used for both persisted instances
 * and new instances
 * 4.3). The instance should not be listed in the instance list
 * 4.4). The total count of the instance schema class and its ancestors should be updated by reducing 1 in the schema tree if it
 * is displayed (schema view)
 * 4.5). The total count of the page view for the instance list including this deleted instance should be updated by reducing 1.
 * 5). When an instance is committed for deletion (Step 2), the following should happen:
 * 5.1). The instance should be removed from the deleteInstances list in the store
 * 5.2). The instance should be removed from the cache
 * 5.3). The server-side will remove the instance from the database and add an InstanceEdit to the modified slot for all
 * referrers to this deleted instance.
 * 5.4). When a referrer is viewed at the front end, the user should see this added InstanceEdit in the modified slot.
            The server side needs to change so that this list of referrers is return for the update, in case referrers are cached in front end
 * Anything missing?

