### Build on July 13, 2026

- The duplication check is now limited to PathwayDiagram instances only for the time being. Guanming and I will fix this logic and apply it to all instances correctly in the future.

- The action menu used to hang in the top-left corner due to a rendering issue with Species' warning dialog. This is now fixed. (Lisa had reported this issue).

- The issue of needing to select "OK" multiple times to log in has been fixed. I did notice this issue once more when I was logged out automatically and then tried to log in again. I will take another look.

- The user will be automatically logged out after 18 minutes of inactivity. A dialog warning the user of the logout will appear after 17 minutes with the option for a user to continue to stay logged in.


### Build on July 14, 2026

- When adding a new instance as an attribute to another instance the drop down menu provided in "Add via selection" and "Add via creation" will use concrete class instead of the parent abstract class. For example, in "hasEvent" the drop down will no longer show only "Event", but "Pathway", "Reaction", "Black Box Event", etc. (We may add the abstract class back to the list if requested).

- The interface for the advanced search has been improved to be more user friendly. 

- Editinig the "species" attibute of an instance will only prompt the warning dialog if a StableIdentifier has already been assigned to the instance. This is because an edit to the species attribute would only further affect an instance that has already had a stable identifer generated. 


### Build on July 15, 2026

- Clear the user's refresh cookie with a true logout sent to the server. This is to fix the issue of needing to send a login request twice.

- The the "hasDiagram" toggle attribute is now a "noManualEdit" attribute.

- Fix the LiteratureReference to allow a pubmed link and a pubmed id.

- User's Pathway Diagram locks were not visible in the schema view. The panel has been made visible with locks loaded with the rest of the status content. 

- Fix to the "Are you still there" dialog which warns the user that their time of inactivity is exceeding its limit. This dialog would appear with a countdown even after the limit if the user navigated away and came back. Now it should not display if the user exceeds their limit, just log them out and redirect to the login. 

- ReferenceGeneProduct instances now have a "Create EWAS from ReferenceGeneProduct" button in the expanded action menu of both the list instances view and the instance view. It creates a new EntityWithAccessionedSequence and copies over the shared attributes (referenceEntity, species, and names), porting the equivalent action from the Java Curator Tool.