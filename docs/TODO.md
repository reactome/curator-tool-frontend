#### Bugs:
- The autoscroll for the instance view in the event view scroll the whole instance view. But we need to scroll the table content only just like in the schemw view. (some fixed, but not fully ideal)
- go to pathway in the diagram sometimes has weird selection: the pathway selected is stuck in the URL!
- the reset in the comparison table cannot fire event across the browser tabs.
- resizing the nodes cannot change the height of the background for selection. However, sometimes it does work!
- the order inner and outer layers of a compartment needs to be controlled. It is quite random right now.
- bug: display name (e.g. change a regulator for a Regulation) cannot trigger the change to the displayed instance. This needs to be handled as in other instance edit action.
- bug: deleting or updating display name cannot update the loaded instances.
- Bug: the connecting positions are not updated for helper nodes when they are dragged during editing. (??)
- Bug: inner shapes are not updated when resizing nodes.
- Bug (fixed. Kept for future test): When a PE is used as both input and catalyst, enable/disable editing in pathway diagram cannot recovers the original diagram (input or catalyst may get lost, e.g. http://localhost:4200/event_view/instance/453279?select=8848436) - Bug: LLM geneates text for ALDOB having the original template [PMID: 123456] that is not replaced. See Peter's email on Nov 13, 2024.
- TODO: When an instance is deleted from the instance list (schema view), make it it is removed from the list view automatically. Also make sure the total count is reducted in the schema tree.
- TODO: Add a check for circular reference (e.g. precedingEvent): this should be avoided in any case!
- TODO: Check all code to make sure subscriptions are removed when a component is destroyed.

#### Deidre
- Bug: After the browser starts or refreshed, click an instance in the changes tab switches to the schema tree. It should be stay at the changes tab.
- TODO: In the instance list, make sure scrolling limits to the instance list, not the top panels. Right now, paging controls are fine, staying at the bottom without scrolling.
- BUG: deletion should remove the instance in the instance list even though it is not committed for existing instances
- TODO: Use the new set of Reactome icons at Figma, designed by the EBI team.
- TODO: The status bar is not at the same vertical position at the home page and the other two views (schema view and event view), resulting a little bit jumping when switching from home to these views.
- Bug: In the event view, the mouse position is lowed when scroll up/down the instance view.
- instance comparison: between two instances in the list view
- TODO: When two instances are compared, change "only show edited attribute" to "attributes having different values".

#### TODO:
- Need to style the detailed table view for schema class.
- isCanonocal in Pathway cannot be edited
- bug: regulation is not defined in RegulationReference. It is regulatedBy in the Java class model.
- Make sure to use undefined, not null, to make the coed consistent. Check with the table editing results. Right now: text returns "" and non-text returns null!
- bug: PathwayDiagram is not listed in the schema tree! Also check its display name generation.
- bug: the layers of compartment are not right now. Some compartments cannot get selected: http://localhost:4200/event_view/instance/157858, inside compartments, caused by the order of plotting compartments. This needs to be fixed.
- TODO: Set the color of icons in the event tree for dark mode. Right now, they are all black, which cannot be seen in the dark mode.
- Make sure the disease pathway diagram is correct. Right not it is not!
- Need some big refactoring for classes in the pathway diagram module: Right now they are all cross-linked together, esp. diagram service utils.
- For Figure instance: add a customized view to display the figure
- for no-instance edit, press return should commit the change. Control-return should add a new line. (now control+return commits the change)
- pathway diagram: deletion of a reaction in the diagram should delete that reaction. This applies to other object (e.g. a PE that is linked to a reaction).
- stoichioemtry update has not done yet for diagram update after instance editing.
- Add a check for event tree to see if there is any circular reference
- Imagine this scenario: A db instance is loaded. However, one of its attribute is deleted. Therefore, the view for the curator should see the instance without this deleted instance at browser. Should this instance be flagged as updated instance? Probably not since committing the deletion will handle this automatically. Also marking as updating will bring about some side effects (e.g. push to the local storage). But after the loading, the curator start to editing it. Now this instance is updated. Should the modified attributes include the attribute impacted by deletion, assuming the manul edited attribute is not that attribute. Probably we just need to introduce a new field in Instance, deletionImpactedAttribute? For the time being, just add the impacted attribute into the modified attribute list, but not mark it as updated. Need to revisit this later on.
- resize: need to make sure all associate attachments (e.g. modification, resizing widgets can be moved around).
- compartment id: since the same compartment can be added multiple times, therefore, we need a central way to manage id
- refactoring the menus for diagram editing: make them more streamlined.
- TODO: Better to come with a new implmenetation of finding all paths between two nodes instea of hacking the code for using aStar in hyperEdge.ts (enableRoundSegments and enableRoundSegmentsForFlowLine)
- data model: modified is single-valued in the current graph model
