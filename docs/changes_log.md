### Build on July 24, 2026

- Added the ability to change an instance's schema class. From the instance view you can open a dialog and pick any concrete class. Before the change is allowed, every referrer that points at the instance is checked to make sure the instance would still be valid under the new class; if any referrer's attribute would no longer accept it, the change is blocked and the offending referrers are listed (each can be opened in a new tab to resolve the reference first).

- Added stoichiometry support for adding and editing multivalued instance values. You can now set the stoichiometry (number of copies) of a value when adding it via the "new instance" and "select instance" dialogs, and change the stoichiometry of an existing value from its action menu via a small dialog.

- Testing the crash when committing instances that contain circular references (e.g. A → B → A). Preparing such an instance for commit previously recursed indefinitely and overflowed the stack; cycles are now detected and handled safely while still allowing the same instance to appear in separate branches.

- When committing a new instance that matches existing instance(s) in the database, you can now resolve each duplicate directly from the "Matches Found" dialog instead of only committing it anyway. For each matched new instance you choose an action: leave it uncommitted (default), commit it as a new instance, use an existing match instead, or merge the new instance into an existing match. "Use existing" discards the new instance and repoints everything that referenced it at the chosen existing instance. "Merge" copies the new instance's attributes onto the chosen existing instance (single-valued attributes are overwritten; multivalued attributes have the new values appended), then repoints references and discards the new instance. Resulting edits are staged for review, not committed immediately.

- Redesigned the "Matches Found" dialog for clarity: each matched new instance is now a card with a single Action dropdown (and, for use/merge, a picker for which existing instance to target) plus a show/hide view of the matches, replacing the previous mix of checkboxes and per-row buttons.

- Keep the same network view in the pathway editing during toggling enable/disable editing.

- Data model update: orthologousEvent and inferredTo are changed from optional to non-manual edit. For curation, curators should use inferredFrom

- Bug fix: activeUnit for CatalystActivity can be saved now. Prevously it cannot.

- Bug fix: advanced search for some instance-type attributes may not work (e.g. inferredFrom). This has been fixed.


### Build on July 21, 2026

- The search query has been updated to accept symbols and more complicated search results, such as a reaction name. 

- When adding a new instance via selection or creation it is now added after the instance the edit option was chosen from. Before the instance was added above the instance in the list and the user had to rearrange. 

- The automatic backup has a flag to check if changes have been made before backing up the same instances twice. 



### Build on July 20, 2026

- Add undo/redo (25 steps) for pathway edits: Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl+Y (redo).

- Add a toolbar at the top of the diagram component for major editing functions, including zoom in/out, fit to view, which may be used to scroll the diagram

- Adjust the diagram component size to remove scroll bars: address the scrolling issue reported by Ralf and Karen

- Enable open/close subclasses in the schema tree

- Show "Literature Reference" first for creating and selecting dialogs for an attribute taking Publication

- Added a shortcut to unlock pathway diagram lock. Unlocking a diagram now uses the existing confirmation dialogs for a consistent experience.

- When the connection to the server is lost, you are now redirected to the login page and then returned to the page you were originally on after logging back in, so you no longer lose your place.
- Added a new feature to show backups of curators' staged instances: You may restore a previous backup. The current one should be saved automatically when you reload the browser. The timestamp shown is now your browser's local time.

- Updated user guide for the above features



### Build on July 17, 2026

- Logic for creating an EWAS from a RGP has been updated so that start and end coordinates can be populated from the "chain" attribute of the RGP instead of fetching coordinates from Uniprot which has changed.

- The links in the mismatch table were not working. These have been updated and some additional formatting added.

- The expand/collapse arrows in the referrers table now reflect the state of each table. A right-pointing arrow indicates a collapsed table and a down-pointing arrow indicates an expanded table.

- The dialog to add new instances via selection now allows candidate classes (the top level abstract class allowed) and all of the concrete classes. ie. A user may search all "Event" types without knowing the sublcass, or search by a specific "Pathway", Reaction", etc.

- Fixed a bug where editing an attribute (e.g. adding an event to "hasEvent") on a pathway that was navigated to within the Event view would appear to take for a moment and then be lost - both on screen and after logging out and back in. The displayed instance had drifted from the cached copy, so the edit never reached the cache that the display refresh and the save both read from. Edits are now written back to the cache when registered, keeping the instance view, the event tree, and saved changes in sync.

- In the changed-instances list, clicking an instance's display name or dbId now opens it in whichever view you are already in: the schema view opens the instance view, and the event view opens the pathway diagram for event instances (pathways/reactions).


### Build on July 15, 2026

- Clear the user's refresh cookie with a true logout sent to the server. This is to fix the issue of needing to send a login request twice.

- The the "hasDiagram" toggle attribute is now a "noManualEdit" attribute.

- Fix the LiteratureReference to allow a pubmed link and a pubmed id.

- User's Pathway Diagram locks were not visible in the schema view. The panel has been made visible with locks loaded with the rest of the status content. 

- Fix to the "Are you still there" dialog which warns the user that their time of inactivity is exceeding its limit. This dialog would appear with a countdown even after the limit if the user navigated away and came back. Now it should not display if the user exceeds their limit, just log them out and redirect to the login. 

- ReferenceGeneProduct instances now have a "Create EWAS from ReferenceGeneProduct" button in the expanded action menu of both the list instances view and the instance view. It creates a new EntityWithAccessionedSequence and copies over the shared attributes (referenceEntity, species, and names), porting the equivalent action from the Java Curator Tool.
(Actually, the coordinates need to be added still, this will be added soon!)

- The duplcates table is back with a "commit anyway" option. 


### Build on July 14, 2026

- When adding a new instance as an attribute to another instance the drop down menu provided in "Add via selection" and "Add via creation" will use concrete class instead of the parent abstract class. For example, in "hasEvent" the drop down will no longer show only "Event", but "Pathway", "Reaction", "Black Box Event", etc. (We may add the abstract class back to the list if requested).

- The interface for the advanced search has been improved to be more user friendly. 

- Editinig the "species" attibute of an instance will only prompt the warning dialog if a StableIdentifier has already been assigned to the instance. This is because an edit to the species attribute would only further affect an instance that has already had a stable identifer generated. 


### Build on July 13, 2026

- The duplication check is now limited to PathwayDiagram instances only for the time being. Guanming and I will fix this logic and apply it to all instances correctly in the future.

- The action menu used to hang in the top-left corner due to a rendering issue with Species' warning dialog. This is now fixed. (Lisa had reported this issue).

- The issue of needing to select "OK" multiple times to log in has been fixed. I did notice this issue once more when I was logged out automatically and then tried to log in again. I will take another look.

- The user will be automatically logged out after 18 minutes of inactivity. A dialog warning the user of the logout will appear after 17 minutes with the option for a user to continue to stay logged in.
