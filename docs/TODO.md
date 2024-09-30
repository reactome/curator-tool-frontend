#### Bugs:
- After the browser starts or refreshed, click an instance in the changes tab switches to the schema tree. It should be stay at the changes tab.
- Make sure the diagram is in editing disabled state when uploading to the server or disable editing when loading back.
- The autoscroll for the instance view in the event view scroll the whole instance view. But we need to scroll the table content only just like in the schemw view.
- skip and limit are not udpated even for simple search
- go to pathway in the diagram sometimes has weird selection: the pathway selected is stuck in the URL!
- the reset in the comparison table cannot fire event across the browser tabs.
- resizing the nodes cannot change the height of the background for selection. However, sometimes it does work!

#### Deidre
- deletion needs to refresh the list if it is done in the list (maybe not if it has not committed. Probably only for new instance?)
- new instance is not in the list for selection: so it cannot be used for reference. Basically it is not in the list at all.
- For some list: new instances will not be included for consistence. However, for edit via selection, they need to be listed so that the user can choose them as new values.
- referer check has not considered the updated and new instances
- the height distribution is not working in safari!
- how to avoid reload the schema tree when a new instance to create or listing instances: this is annoying when the mouse is around the end of the tree since the mouse position is shifted: this occurs when the view switched between list and instance.
- the deletion action in the changes list for new instances don't show any warning: the behavior should be consistent between the instance view and the changes list.
- a new instance is in the bookmarks, deleting this new instance doesn't remove this instance from the bookmark list.
- edit via creation: cancel new instance creation causes the browser hanging. The new instance is not removed from the changes if cancelled.
- Bug: After filtering to changed only attribute in the comparison table, turn off the comparison. There is no way to show the whole table now.
- Bug: When an attribute is a single-valued attribute, make sure there is only one instance can be selected in the instance list.

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


#### Notes:
- the following version or configuration are important for compiling: "@langchain/openai": "^0.0.12" (March 14, 2024) in package.json and "skipLibCheck": true in tsconfig.json, // Based on to fix langchain issue:https://github.com/langchain-ai/langchainjs/issues/3793
- To build an angular component, follow https://www.telerik.com/blogs/angular-component-library-part-1-how-to-build. The pack is very important. Otherwise, it will not work! To install the component from reactome's ngx project, use: npm i {path_to_the_component} (e.g. ../ngx-reactome-base/dist/ngx-reactome-diagram/ngx-reactome-diagram-0.0.16.tgz). Note: make sure the version updated. Otherwise, the loaded library will not be updated in the chrome debug!!!

