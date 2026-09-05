### Build on September 5, 2026

- Bug fix: visiting the site itself (`/curatortool/`) or `/curatortool/home` directly - rather than arriving there via login - showed a blank page instead of either the login form or the home page, even though logging in and navigating around afterward both worked fine. The route guard that sends a signed-out visitor to `/login` was redirecting by calling the router directly instead of returning its result the way Angular expects; on this particular path that redirect landed while the app's very first navigation was still being resolved, and the two silently cancelled each other out. It now hands the redirect back the way the router expects instead, which resolves cleanly as part of that first navigation.

- Added: the "Create a New Instance" dialog now scrolls straight to the **name** slot as soon as a schema class is picked, for any class that has one - it's the slot almost every new instance needs filled in first, and it could otherwise sit well below the fold on a class with many attributes, so this saves scrolling and hunting for it on every instance created. Also tidied up the dialog: the class picker no longer cuts off long class names, and the class picker and attribute table now sit together inside a bordered panel instead of floating loose in the dialog.

- Bug fix: once in a while in production, logging in successfully still left the curator on the login page (or briefly showed the home page before bouncing back to it), requiring a second click of "OK". A stale, already-expired session left over from before the tab was opened triggers a background logout - including a server round trip to back up whatever was staged under it - as soon as the app loads, before the login form is even submitted. If that round trip was still in flight when the curator finished logging in with fresh credentials, its cleanup ran anyway and wiped the brand-new session's token, sending the tab back to /login. This only showed up against the deployed backend, where that round trip takes long enough to still be running by the time a real login completes; it never happened in a fresh incognito window (nothing stale to log out in the first place) or against a local dev server (the same round trip there finishes before anyone can type a password). That stale-session logout now checks, right before clearing anything, whether its own session is still the current one - if a fresh login has since replaced it, it leaves the new session alone instead of tearing it down.

- Bug fix: yesterday's fix for the attribute table jumping to the top after an edit (below) updated table rows in place by matching them up by attribute name alone, without regard to which instance they belonged to. Switching the instance on display - for example after creating a new one - could then leave an editable cell holding onto the outgoing instance's row, so an edit in that slot could land on the wrong instance's data. That row-matching has been removed; every reload of the table builds its rows from scratch again, as it did before yesterday's build. The scroll position is instead saved before the rebuild and put back afterwards when the reload is for the instance already being shown (such as after an edit); switching to a different instance still starts at the top.

### Build on September 4, 2026

- Bug fix: adding a value to a slot near the bottom of a long instance - a summation or the species of a pathway, say - jumped the attribute table back to the top, so you had to scroll down again to carry on with the lower slots. After every edit the table was rebuilt by discarding all of its rows and creating them again from scratch; on an instance with enough attributes to scroll, the browser sees the table empty for an instant during that and resets the scroll position to the top. The table keeps rebuilding its rows the same way, but now remembers where you were scrolled to and puts you back there afterwards, rather than leaving you at the top. Opening a different instance still starts at the top. (See the September 5 entry above for a correction to how this was first implemented.)

- Bug fix: refreshing the instance already on display - which happens by itself after an edit, or when an auto-filler regenerates a display name - briefly replaced the whole attribute table with the loading spinner, discarding your scroll position and flickering. It is now refreshed in place. Switching to a different instance still shows the spinner. This also fixes an error that could interrupt such a refresh part way through, leaving the spinner up.

### Build on September 3, 2026

- Added navigation controls to the pathway diagram, ported from the public pathway browser: a thumbnail of the whole diagram in the bottom-right corner, with the part currently on screen drawn as a bright rectangle against the dimmed rest of it, and a wheel of pan buttons plus **Fit to screen** in the bottom-left. Press anywhere on the thumbnail - or press and drag across it - to bring that part of the diagram into view, which is quicker than scrolling for a large pathway where what you want is off screen. Both work whether or not editing is enabled, and the thumbnail redraws itself as you edit, so it always shows the diagram as it now stands rather than as it was when opened.

- In both the event view and the schema view, the bread crumb, the toolbar, and the attribute table's own header row now stay in place while the attribute table scrolls, instead of scrolling away with it. On a long instance you no longer have to scroll back to the top to see which attribute a column belongs to, or to reach the toolbar and the bread-crumb trail.

- Bug fix: on the deployed site, the two buttons that switch an event between the schema view and the event view were again opening an address outside the app - typically a "not found" page - rather than the other view of the instance you were looking at. This is the same symptom fixed on August 27: the address left out the `/curatortool/` part the deployed site sits under. It came back because the change on August 7 that gave each of the two views its own dedicated tab built the address a different way, one that is resolved from the top of the server rather than from inside the app. Neither way of building it shows the problem when the app is run locally, where there is no `/curatortool/` to leave out. Both buttons now build the address the same way as every other link in the app that opens a new tab, so the two cannot drift apart again.

- Bug fix: for a reaction with two or more inputs (or outputs) that share a single connecting point in the diagram, using **Auto-Fix** after one of them was replaced with a different one could remove every input or output sharing that point - not just the one being corrected - leaving the reaction looking like it had lost its connections entirely. Fixed.

### Build on September 2, 2026

- Bug fix: **Validate Diagram Against Database** could keep reporting the exact same reaction-structure problems (a catalyst, activator, or inhibitor shown as missing or extra) no matter how many times **Auto-Fix** and **Upload Diagram** were run in a row. The published diagram file it checked against is regenerated under the pathway's own identifier rather than the diagram's, so for diagrams where those two differ, uploading never actually reached the copy being checked - it stayed stuck showing whatever the diagram looked like before the fix. Validate Diagram Against Database now checks the diagram actually open in the editor instead, so a fix shows up as fixed the moment you re-run it, without having to upload first just to confirm it worked.

- Because of the change above, running Validate Diagram Against Database no longer by itself means the currently-published version is up to date - only **Upload Diagram** does that now. Validate Diagram Against Database and Auto-Fix each show a reminder to upload whenever there's something unsaved, so a fix - or a clean report - doesn't quietly fail to make it into the next release.

- Bug fix: when a catalyst's or a regulator's connecting line had a bend in it rather than running straight to the reaction, **Auto-Fix** could fail to recognize the connector was already there and add a second, duplicate link for the same catalyst or regulator. Fixed.

- Bug fix: **Validate Diagram Against Database** failed outright on a pathway diagram that had never been through **Upload Diagram** before. It now checks reaction structure, PhysicalEntity names, Sub-Pathway names, and Compartment names correctly for a brand-new diagram too.

### Build on September 1, 2026

- **Validate Diagram Against Database** now also checks modified-residue marks (the small labeled marks on a protein showing things like a phosphorylation site) against the database, catching ones that are missing, extra, or show the wrong label. **Auto-Fix** adds, removes, or relabels these marks to match.

- Turning off diagram editing now automatically backs up your unsaved changes instead of asking whether to upload first - it's meant to be a quick, reversible way to see how the diagram looks without the editing controls, not a commit point. Turn editing back on and your changes are still there, exactly as you left them.

- Bug fix: for a pathway diagram shared between more than one pathway (for example a disease and normal variant of the same pathway), **Validate Diagram Against Database** could check a different, unrelated copy of the diagram instead of the one actually open for editing, making its results look inconsistent from one pathway to another. It now always checks the diagram actually being edited.

- After **Auto-Fix** corrects a diagram, a reminder now tells you to upload it before running **Validate Diagram Against Database** again - otherwise validation checks the previously-published diagram and can appear to still show the same issues, even though the live diagram has already been corrected.

- Bug fix: opening a reaction or complex where a participant appears more than once (for example a reaction using 4 molecules of ATP, or a tetramer made of 4 copies of the same protein) showed it only once, with the true count lost. This also meant **Auto-Fix** could not actually correct a stoichiometry mismatch flagged by **Validate Diagram Against Database** - it looked like nothing had changed after fixing it. Both are now fixed.

- Bug fix: a modified-residue mark (for example a phosphorylation site) added or corrected during diagram editing - including via **Auto-Fix** - could silently fail to appear in the diagram actually published after uploading, even though it looked correct on screen while editing. These now upload correctly.

### Build on August 31, 2026

- Bug fix: opening certain heavily-referenced instances in the instance editor - small molecules used by a huge number of reactions (for example ATP or ADP), or a species used by nearly every instance (for example Homo sapiens) - could hang or take a very long time to load, because the server was gathering every instance that refers to the one being opened, not just its own attributes. Loading now looks only at what the instance itself actually holds, so these instances open quickly and reliably, the same as any other.

- Bug fix: on the deployed site, the **Show Referrers** action item and the link icon in the referrers dialog opened a broken address that left out the `/curatortool/` part of the URL, so neither one worked (the link icon's address could also be copied and shared, but would fail for whoever opened it too). Both now open the referrers page correctly.

- **Validate Diagram Against Database** now also catches drawn objects - entities, sub-pathways, compartments, or whole reactions - whose underlying database record has since been deleted (for example, after a curator deleted or merged something without regenerating the diagram). These are listed as failures rather than silently passing, and **Auto-Fix** removes them from the diagram along with any of their own connectors.

- **Validate Diagram Against Database** now also checks modified-residue marks (the small labeled marks on a protein showing things like a phosphorylation site) against the database, catching ones that are missing, extra, or show the wrong label. **Auto-Fix** adds, removes, or relabels these marks to match.

### Build on August 30, 2026

- Added a **Validate Diagram Against Database** button to the pathway diagram toolbar (shown while editing). It scans everything drawn - PhysicalEntity nodes, sub-Pathway nodes, Compartments, and reaction structure (inputs, outputs, catalysts, regulators) - against the live database, so a diagram whose saved layout has drifted from what's actually been committed (for example, after an entity was renamed or a reaction's inputs changed elsewhere, without the diagram being regenerated) is caught rather than silently shown as-is. Results are listed as a set of pass/fail checks, each failure as a table of mismatches with clickable instance links. When something fails, an **Auto-Fix** button corrects the live diagram to match the database - it only changes what's on screen and does not save on its own, so the result can be reviewed (and undone, like any other edit) before choosing to upload it.

- Bug fix: disabling editing on a pathway diagram while it had unsaved changes discarded them without warning, and re-enabling editing afterwards loaded the last-saved diagram as if the changes had never been made. The confirmation this is meant to go through - "This diagram has unsaved changes. Upload before disabling editing?" - existed in the code already (it is the same prompt used when unlocking a diagram) but had been left disconnected, so disabling editing always went ahead immediately. It is now asked every time, the same as unlocking.

- Bug fix: right after auto-fixing a diagram (or, occasionally, right after any other live edit), the **Upload Diagram** button could fail to appear even though the diagram genuinely had unsaved changes. A background check that keeps the "unsaved changes" flag in sync with the editing lock could win a race against the edit that had just been made and reset the flag back to "nothing to save" before the next screen update, hiding Upload. That background check no longer overrides a change that is already known about locally.

- The **Show Referrers** action on an instance-valued attribute slot now opens the referrers page in a new tab instead of navigating away from the instance you were looking at.

- Browser tabs and history now show a title specific to what's displayed - the instance, the pathway, or the referrers page you're viewing - instead of every tab being titled "Reactome WebBench" and being indistinguishable from one another in your browser's tab bar or history.

### Build on August 27, 2026

- In the pathway diagram, **Go to Pathway** and **Delete Pathway** now work the same way for every kind of pathway node, including ones representing a nested sub-diagram (previously only one of the two kinds supported deletion). **Delete Pathway** is only offered while editing is enabled - deleting is an edit, so it no longer appears while you're just viewing a diagram.

### Build on August 26, 2026

- Added a **Show Referrers** entry to the action menu on an instance-valued attribute slot (in addition to the existing referrers access points), so you can check what refers to a value without first opening it.

- Bug fix: revisiting an instance already earlier in your view history (for example, re-selecting it in the staged-changes list or the event tree, rather than clicking back through the bread-crumb) left the bread-crumb trail pointing past the instance actually being shown, instead of ending at it. Revisiting an instance already in the history now trims the trail to end there, the same as clicking that instance's own bread-crumb link would.

### Build on August 24, 2026

- Bug fix: opening a pathway diagram could crash outright - showing nothing at all - if its saved layout referred to a connector or a link whose entity or reaction no longer existed (for example, after a deletion that happened without the diagram being regenerated to match). One such stale reference used to take down the entire diagram; it is now skipped on its own, and the rest of the diagram is drawn correctly.

### Build on August 27, 2026

- Bug fix: on the deployed site, the two buttons that switch an event between the schema view and the event view opened a browser tab that was not Webbench at all - typically a "not found" page - instead of the other view of the instance you were looking at. The address they opened left out the `/curatortool/` part of it, so it pointed at the top of the server rather than into the app. This never showed up when the app was run locally, where there is no `/curatortool/` in the address to leave out. The link icon in the referrers dialog, which opens the referrers page in its own tab, was wrong in exactly the same way and is fixed with it.

- Bug fix: on the deployed site, logging back in after your session ended returned you to the home page rather than to the instance you had been working on. Being signed out by the 18-minute inactivity timeout, by a lost connection to the server, or by another window logging out was supposed to remember the page that window was showing and take you straight back to it. What was remembered included the `/curatortool/` part of the address, which the app then could not make sense of as one of its own pages, so it quietly gave up and used the home page instead - meaning the several windows you had open on different instances all came back on `/home` with their views lost, the very thing remembering the page was added to prevent. Deep links you had followed or pasted yourself were remembered correctly and are unaffected.

### Build on August 21, 2026

- A bug was reported for attribute value comparison of two different instances. Before the "show attributes having different values" would actually display no values. This has been fixed so that two different instances can be directly compared, and only varying attributes listed.

-  The upload button at the top of the BOOKMARKS panel now opens an "Add Bookmarks" dialog with two containers, and you use whichever suits what you already have. The first is a box you paste dbIds into: anything that is not a digit separates one dbId from the next, so a column copied out of a spreadsheet, a comma-separated list out of an email, dbIds typed by hand, or a sentence with the dbIds embedded in it all read the same and there is nothing to tidy up first. A minus sign standing on its own in front of the digits is read as the number's sign, so a new, not-yet-committed instance can be pasted exactly as it is shown; a minus joined to what precedes it is a separator like any other, so a stable id such as R-HSA-111 is read as 111 rather than as -111, and a range such as 111-222 as the two dbIds it looks like. The second container is the file upload as it was, now stated as its one actual requirement - a CSV or TSV file whose first column holds the dbIds, every other column ignored and a header row skipped - and .tsv files can now be picked in the file chooser rather than only .csv. Both paths report the same way afterwards: how many bookmarks were added, how many of the dbIds were already bookmarked, how many repeated dbIds were read once, and which dbIds no instance could be found for, with the same 500-dbId limit as before.


- An instance's referrers now have a page of their own at a fixed address - `schema_view/referrers/<dbId>/` - so the list can be bookmarked, pasted into an email or a ticket, or simply reloaded. Until now referrers only existed in a pop-up dialog, which meant there was no way to point anyone at them: the only instruction you could give was "open this instance, then press the referrers button". The page is titled "Referrals" and lays the list out as a plain two-column table, the referring attribute on the left and the instances referring through it on the right, each of them a link to that instance. The pop-up dialog is unchanged and still the quickest way to glance at referrers while editing; it has gained a link icon in its title bar that opens this page in a new tab. An address with an id that isn't a number, or that names an instance which can no longer be loaded, says so plainly rather than showing an empty table.


- Lists of instances of a class that has a species slot - Pathway, Reaction, Complex, EntityWithAccessionedSequence, ReferenceGeneProduct and the rest - now have a species quick filter at the right-hand end of the toolbar naming the class, with three settings: All (no filtering, how a list starts out), Human, and Non-human. It narrows whatever the list is already showing rather than replacing it, so it can be combined with a term typed in the search box or with a set of advanced search conditions, and the download button gives you the filtered set. The setting travels in the URL, so reloading the page or sharing the link keeps it. Classes with no species slot don't show the filter at all. Note that "Non-human" means "has a species, and one of them is not Homo sapiens": an instance with no species at all appears under neither Human nor Non-human, and one curated for both human and another species appears under both.

### Build on August 16, 2026

- Bug fix: closing every open Webbench window for longer than the 18-minute inactivity limit, then reopening the app, resumed the same session without asking you to log in again. The inactivity check only ever ran while a window was open to watch the clock, so however long passed while every window was closed was never counted against it. Reopening the app now checks how long it's actually been since the session was last active before doing anything else, and signs you out immediately if that already exceeds the limit - the same as if a window had been open the whole time.

- Bug fix: after every window was signed out - by the inactivity timeout, or by one window logging out - logging back in on one of them left every other window still sitting at the login page, even though the session was valid again; there was no way for them to find out. Logging in on any one window now brings the others back in too, each returning to whichever page it was on before being signed out.

- Added a "Find by dbId" search to the pathway diagram toolbar. Click the search icon, type the dbId of an object, and press Enter: if it is currently displayed in this diagram, it is selected and the view zooms/pans onto it. If it isn't on this diagram, or what you typed isn't a valid number, you're told so directly instead of the search doing nothing.

- Bug fix: marking an Event as externally reviewed (setting `reviewed`) recorded that the review status was about to change but never actually carried it out - the instance's review status stayed exactly as it was, still showing its old star rating as if the review had never been added. This went unnoticed the more thoroughly an event had already been reviewed: it happened precisely when `reviewed` was added to an event that was null, two-star, three-star, or four-star, i.e. every case this action is supposed to promote to five stars. reviewStatus is now actually promoted to five stars in this case, and the change is correctly flagged so the rest of the app picks it up.

- Bug fix: bookmarking a new instance you had not yet committed didn't really work - the bookmark disappeared the next time the app loaded (or a backup was restored), and dragging it into an attribute told you it "no longer exists in the database" even though nothing had been deleted. Every bookmark was checked against the database to confirm its instance still existed, but a brand-new, not-yet-committed instance has no database record to check yet, so it was always reported as gone. A bookmark on a new instance is now checked against your own staged work instead, and is only dropped once that instance is actually discarded before being committed.

- Bug fix: while working normally - often only minutes after logging in - you could be told you had been signed out in another Webbench window and be thrown back to the login page, with nothing having been signed out anywhere. Your session is kept alive by a token that all your windows share, and each window renewed it on its own. Because a renewal can only be spent once, two windows renewing at the same moment (which they tend to do, since the token expires for all of them at once) meant one of them was told its renewal was no longer valid - and it concluded the session was dead and signed every window out, moments after another window had renewed it perfectly successfully. Windows now take turns renewing rather than competing; a window that finds another has just renewed carries on with the new token; and the server honours a token that was replaced moments earlier instead of rejecting it. You are only signed out now when the session really has ended.

- Bug fix: a second Webbench window left open in the background could log you out of the window you were actually working in. The 18-minute inactivity timeout was measured per window, and a window sitting behind the one in use sees no typing or mouse movement, so it timed itself out and ended the session for every window - its "you are about to be signed out" countdown having run invisibly behind the window you were using. Inactivity is now measured across all of your windows together: as long as you are working in any one of them, none of them times out. If a countdown is showing in a window you are not looking at and you start working in another, it is dismissed instead of signing you out.

- In the referrers table (the list, under an attribute, of every other instance that refers to the one you're viewing), the dbId and display name are now clickable and open that instance in its own new tab, the same as the existing launch button already did. They used to be plain, unclickable text - opening a referrer meant hunting down its separate launch button.

### Build on August 7, 2026

- The buttons that switch an event between the schema view and the event view no longer replace what you are looking at. "Open event view" now opens the event view in its own browser tab, and "open schema view" opens the schema view in its own tab, leaving the view you started from as it was. Each of the two views has a single dedicated tab, so switching again re-uses that tab and points it at the new instance rather than piling up windows.

- Bug fix: logging out in one Webbench window left every other open window looking as though it were still signed in, so you could keep working there until something finally failed with an unexplained error. For example: create a reaction, open the compartment picker, launch one of the compartments into a second window, log out there, then come back and press OK and commit - the commit died with "An unexpected error occurred". Logging out (or being logged out by the inactivity timeout, or by an expired session) now signs out every window at once: any dialog still open is closed, you are returned to the login page, and you are told why. Logging back in takes you to the page you were on.

- Bug fix: logging out while the server could not be reached did not actually log you out. The logout first saves your staged changes to the server, and if that save failed the whole logout was abandoned halfway - you were shown the login page, but your session was still live and still usable. The session is now always ended, whether or not the save succeeds.

### Build on August 6, 2026

- Bug fix: dragging a bookmark into an attribute stopped working after navigating away from an instance view and coming back to it (reported by Ralf). The set of attributes willing to accept a dropped bookmark was emptied every time the displayed instance changed, and nothing ever put the attributes of the newly shown instance back into it, so from then on no attribute would take a drag. Attributes now stay registered as drop targets for as long as they are on screen, whichever way you got there.

- While a bookmark is being dragged, the highlight telling you whether it can be dropped now covers the whole attribute slot - which is what the drop actually targets - instead of only the single value the cursor happens to be over. It is drawn as a tinted outline rather than a solid block of colour, so the values underneath stay readable and the row does not shift as the highlight appears.

- Bug fix: opening a Regulation from the regulatedBy slot of a reaction (or from anywhere else referring to it) could snap the view straight back to where you came from, so the Regulation never actually opened. Two things combined to cause this: the display name generated for a Regulation left out the quotation marks around the regulator ("Positive regulation by 'TTC12 [cytosol]'"), which made every existing Regulation look as though it had just been renamed the moment it was displayed, and that apparent rename asked everything referring to it - including the reaction you had just left - to reload, arriving on top of the instance being opened. The quotes are generated again, and a reload can no longer overtake a switch to another instance that is already under way.

### Build on August 4, 2026

- In the matched instances dialog, every matched instance now starts out set to "Use a DB instance instead", pointing at the first of its matches, rather than to "Do Nothing". When more than one instance matched, a new "Action for all" dropdown and "Apply to all" button at the top of the dialog set every match at once to whichever action you pick, each one using its first match as the database instance. Individual choices can still be changed afterwards.

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
