### Build on August 4, 2026

- Bug fix: in the merge instances dialog, a long attribute value (a text slot, or an instance with a long display name) ran past the edge of its column and overlapped the neighbouring one, making it hard to tell which value belonged to which instance. Long values now wrap within their own column, and the columns are separated by a dividing line. Hovering a value still shows it in full as a tooltip.

- Added the ability to merge two instances. From the instance view, the new `merge_type` button behind the "more" button lets you pick a second instance (the picker's class dropdown also offers the ancestor classes, so the two do not have to be of the same class) and then choose between two ways of combining them. "Create a new merged instance" makes a brand new instance in the two instances' common class and lets you pick, attribute by attribute and value by value, what it gets - both originals are left untouched. "Merge one instance into the other" copies the source's single-valued attributes over the target's, appends its multivalued attributes to the end of the target's lists (skipping values the target already holds), repoints every instance referring to the source at the target, and marks the source for deletion; a preview shows what will change and the referrer count before you go ahead. Nothing reaches the database until you commit.

### Build on August 3, 2026

- Deleting an instance (or discarding a new, not-yet-saved one) now automatically removes that reference from every other instance that pointed to it, instead of leaving those referrers pointing at a value that no longer exists.

- Bug fix: after deleting an instance, any other instance that referred to it kept showing its old display name if that name had been generated from the now-removed reference (for example, a PhysicalEntity named for its compartment). Display names for such referrers are now regenerated as soon as the reference is removed.

- Committing a deletion does not mark every referrer of the deleted instance as changed. The database already removes the relationship together with the deleted instance, so only referrers that already had other pending edits are updated locally; referrers with nothing else pending are simply refreshed from the database next time they're opened, instead of being flagged with an edit you never made.

- Staging a deletion (before it is committed) does not touch other instances that refer to the instance you're about to delete; those references are already hidden from view, without being staged as edits, until the deletion itself is committed. This only applies to already-saved instances - deleting a brand-new, not-yet-saved instance still updates its referrers right away, since that removal happens immediately rather than being staged.

- Bug fix: auto-filling a LiteratureReference's details from PubMed could leave its display name and attribute table stuck showing stale values (e.g. "To be generated") until the view was reloaded, because a completion signal needed to refresh them was never sent after the fill finished. That signal is now always sent.

- Bug fix: after refreshing the page (or picking up a deletion staged in another tab), opening an instance you had marked for deletion showed it as empty, with none of its attributes. The deleted-instances snapshot used to restore your staged changes only ever holds lightweight placeholders, not the full instance; opening one now loads its real data from the database instead of getting stuck on the placeholder.

- Bug fix: right after opening (or refreshing) an instance you had marked for deletion, its display name could fail to show in red with a strikethrough, even though the deletion was still correctly staged. The deletion status is now always picked up as soon as it is known, rather than only when a later change happens to arrive after the view finishes loading.

- A bookmarked instance can go stale if it gets deleted (by you in another tab, or by someone else) after you bookmark it. Dragging a bookmark into an attribute now checks that the instance still exists first - if it doesn't, you're told, and the stale bookmark is removed automatically. Every restored bookmark is also checked against the database once after loading (including after restoring a backup or an imported file), and any that no longer exist are dropped.

- Bug fix: committing an instance whose stable identifier had just changed could crash with an error instead of completing. The stable identifier's display name is now correctly refreshed after such a commit.

- Bug fix: an occasional "ExpressionChangedAfterItHasBeenCheckedError" could appear in the console (and in some cases interrupt rendering) right as an instance's deletion status was being picked up. That update is now applied in a way that can't collide with an in-progress screen refresh.

- Bug fix: the check that verifies a bookmarked instance still exists (when dragging it into an attribute, or when bookmarks are restored after reloading) could occasionally be wrong in both directions - a brief network hiccup could make a perfectly valid bookmark look deleted, while an instance already viewed earlier in the same browser tab could still look like it existed even after being deleted elsewhere. This check is now more reliable, and it additionally refreshes a bookmark's display name and class if either was changed by someone else since you bookmarked it.

- Bug fix: after changing an instance's class and committing it, other places that already had a cached reference to that instance - including the same instance open in a different browser tab - could keep showing its old class. Committing a class change now updates every such cached reference, both in the tab where the change was made and in every other open tab.

### Build on July 31, 2026

- Added a new attribute, authorName, on Publication. This is now the default, mandatory way to record author names, as a list of strings. The original author list of Person instances is optional going forward and should no longer be used for new Publication instances.

- Following the change above, auto-fetching a LiteratureReference from PubMed now fills in authorName directly, instead of creating a Person instance for every author, as discussed via email.

- Updated how display names are generated for Publication instances, following Marija's approach (see [this doc](https://docs.google.com/document/d/1lraEKKOBnLpRZ-iVNbdCKFeSKq3LF7PAvOkqPyjy4-4/edit?tab=t.0#bookmark=id.g19wsfbeem8t)) (abbrevations of middle name and first name are kept):
  - More than two authors: "SurnameOfFirstAuthor et al., year, title"
  - Two authors: "SurnameOfFirstAuthor and SurnameOfSecondAuthor, year, title"
  - One author: "SurnameOfFirstAuthor, year, title"

### Build on July 30, 2026

- Bug fix: opening the tool in more than one browser tab at once could occasionally let two new instances (including ones created automatically, such as new isoforms or literature-reference authors) get assigned the same temporary id, with one silently overwriting the other. New instances are now assigned a coordinated unique id shared across all of a user's open tabs.

- Bug fix: staged new/updated/deleted instances did not always survive correctly when working across more than one open browser tab at a time - for example, a staged new instance you had just deleted could reappear after reloading. Your own staged changes, including deletions, are now always kept, and staged changes are also better protected from being overwritten by another of your open tabs.

- Added the ability to export your currently staged new/updated/deleted instances, bookmarks, and default person to a local file, and to load such a file back into your editing session later. Both are available from the status toolbar next to "Restore staged-changes backup" (the download/upload icons). Exporting now prompts you to choose a file name (pre-filled with a timestamped default). Before loading a file, your currently staged changes are automatically saved to the server as a backup first (recoverable via "Restore staged-changes backup"), then replaced by the file's content. Loading a file - or restoring a server-side backup - now updates every browser tab you have open, not just the one you loaded it in.

- Bug fix: a pathway diagram containing a Polymer entity could fail to open. Polymer nodes now render correctly. Note: This is a temporary fix. We will work on this more to get the full rendering graph for polymer as shown in the production server.

- Re-organized actions in pathway diagrams. Enabled deletion of PE nodes without edges. 

### Build on July 29, 2026

- Reorganized the right-click actions menu in the pathway diagram editor for clarity: related actions are grouped together, and actions that don't currently apply are hidden instead of shown disabled.

- Added the ability to delete a PhysicalEntity node directly from the diagram when it has no edges connected to it.

### Build on July 28, 2026

- Bug fix: new instances that are committed as a side effect of committing the instance referring to them (e.g. the new Person instances created for a new LiteratureReference's authors when a PubMed identifier is filled in) stayed in the new instances list with their local negative dbIds, so they could be committed a second time — showing up as duplicates of the instances they had just been saved as. Such instances are now removed from the new instances list and from the local cache when their referrer is committed, and everything still pointing at them is repointed at their database dbIds.

### Build on July 27, 2026

- The bookmark panel no longer covers the toolbars. It is now anchored below whatever header the current view shows (the bread crumb and title bar in the instance view, the taller title bar plus search field in the list view) and stops above the status bar, so the toolbars stay clickable while the panel is open.

- Added a border to the bookmark panel in both the schema view and the event view so its edge is visible against the content behind it.

- Deleted instances are now removed from the bookmark list. This applies both to database instances marked for deletion and to local-only new instances that are dropped before ever being committed, including deletions made through the bulk-delete dialog. The removal now happens even when the bookmark list is not on screen, and deleted new instances are no longer restored from bookmarks that were saved before the deletion.

- Bug fix: cloning an instance no longer copies the "_doRelease" flag. A clone starts with the flag cleared, since released content has to be reviewed again before the clone can be released.

- Bug fix: the commit summary showed "To be generated" instead of the real display name for a new instance that was committed as a side effect of committing the instance referring to it (e.g. a new Reaction pulled in through a new Pathway's hasEvent). The display names in the commit payload are now captured before the commit is sent, so the summary reports the names the curator actually sees.

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
