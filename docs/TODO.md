#### Bugs:
- After the browser starts or refreshed, click an instance in the changes tab switches to the schema tree. It should be stay at the changes tab.
- Make sure the diagram is in editing disabled state when uploading to the server or disable editing when loading back.
- The autoscroll for the instance view in the event view scroll the whole instance view. But we need to scroll the table content only just like in the schemw view.
- skip and limit are not udpated even for simple search
- go to pathway in the diagram sometimes has weird selection: the pathway selected is stuck in the URL!
- the reset in the comparison table cannot fire event across the browser tabs.
- resizing the nodes cannot change the height of the background for selection. However, sometimes it does work!
- the order inner and outer layers of a compartment needs to be controlled. It is quite random right now.
- bug: display name (e.g. change a regulator for a Regulation) cannot trigger the change to the display instance. This needs to be handled as in other instance edit action.
- bug: deleting or updating display name cannot update the loaded instances.

#### Deidre
- referer check has not considered the updated and new instances: bug in the code, function getReferrersOfNewInstance, need to wrap the code inside subscription.
- Bug: Make sure the URL is updated for paging in the instance list component.WORKING
- TODO: List use allowed schema classes instead of concrete. It should be much easier for selection.
- Bug: avoid duplication in instance selection for attribute editing except for input, output, and hasComponent.
- Bug: advanced search, reaction, regulatedBy, is not null cannot work.
- TODO: See if router_link can be used for instance list in the main schema view. Originally it is. Not it is changed to link handling, losing the status update to show the links.
- TODO: In the instance list, make sure scrolling limits to the instance list, not the top panels. Right now, paging controls are fine, staying at the bottom without scrolling.


#### TODO:
- Need to style the detailed table view for schema class.
- isCanonocal in Pathway cannot be edited
- bug: regulation is not defined in RegulationReference. It is regulatedBy in the Java class model.
- bug: If the user does a refresh, any edit will get lost!
- Scroll the schema tree to the bottom, select a class to list instances. The tree scroll back to the top automatically. This is not good. This applies to display the instance table too. 
- bug: the layout is broken when compare EGFR (ReferenceGeneProduct) vs db after making a little bit edit: too much text in the comment slot.
- Make sure to use undefined, not null, to make the coed consistent. Check with the table editing results. Right now: text returns "" and non-text returns null!
- bug: PathwayDiagram is not listed in the schema tree! Also check its display name generation.
- Bug: After filtering to changed only attribute in the comparison table, turn off the comparison. There is no way to show the whole table now.
- bug: In the updated instances table, when the display name is really long, no action buttons can be seen.
- todo: how to handle label of the compartment? In the editing mode, make compartment movable. However, we have to disable resizing and then make sure the two layers are posititioned correctly.
- bug: the layers of compartment are not right now. Some compartments cannot get selected: http://localhost:4200/event_view/instance/157858, inside compartments, caused by the order of plotting compartments. This needs to be fixed.
- TODO: Set the color of icons in the event tree for dark mode. Right now, they are all black, which cannot be seen in the dark mode.
- Make sure the disease pathway diagram is correct. Right not it is not!
- Need some big refactoring for classes in the pathway diagram module: Right now they are all cross-linked together, espect to diagram service utils.
- When fetch the data for a reaction to be drawn in a diagram via add to diagram, make sure the local, edited content is checked.
- For Figure instance: add a customized view to display the figure
- list instance: the URL should have skip and limit there. These two values should be updated just as in simple search.
- commit a new or update instance needs to commit all other referred instances too
- add instance edit at the server-side to the created (for new instance) or the modified slot (for updated instance)
- instance comparison: between two instances in the list view
- for no-instance edit, press return should commit the change. Control-return should add a new line.
- for deletion, if no referrers existing for an instance, don't show the referrers dialog.
- pathway diagram: deletion of a reaction in the diagram should delete that reaction. This applies to other object (e.g. a PE that is linked to a reaction).
- stoichioemtry update has not done yet for diagram update after instance editing.
- Add a check for event tree to see if there is any circular reference
- Imagine this scenario: A db instance is loaded. However, one of its attribute is deleted. Therefore, the view for the curator should see the instance without this deleted instance at browser. Should this instance be flagged as updated instance? Probably not since committing the deletion will handle this automatically. Also marking as updating will bring about some side effects (e.g. push the the local storage). But after the loading, the curator start to editing it. Now this instance is updated. Should the modified attributes include the attribute impacted by deletion, assuming the manul edited attribute is not that attribute. Probably we just need to introduce a new field in Instance, deletionImpactedAttribute? For the time being, just add the impacted attribute into the modified attribute list, but not mark it as updated. Need to revisit this later on.
- Need an action to add a new compartment into the diagram
- resize: need to make sure all associate attachments (e.g. modification, resizing widgets can be moved around).
- compartment id: since the same compartment can be added multiple times, therefore, we need a central way to manage id
- refactoring the menus for diagram editing: make them more streamlined.
