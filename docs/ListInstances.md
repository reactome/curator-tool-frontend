List-Instances Testing 

For a defined schema class, a list of instances will be returned from the database
The skip parameter determines where in queried list to start 
The limit parameter determines how many items to push into the list to be returned
The paginator is the UI to assist with iterating through the entirety of the instances from the backend so as not to load too many instances at once.
Three functions for new
The number of instances is from the back-end with no updates from the stores 
Show two bracketed numbers to the right of a schema class. The first is the database number of instances. The second number is all of the local changes made by the user. All instances changed by the user. In the database list, still show the unmodified displayname, but show that instance is modified. Second list shows the new instances and updated displaynames. When the updated instances are clicked automatically show the comparison view. If a db Instance is clicked, show the db version of the instance. As a default for updated instances in BOTH lists show the comparison view. If instance is modified and then deleted, show the deletion and open in comparison mode in BOTH lists . 

Deleted Instances
Do not filter out, but display with the different hue to indicate deletion 
The marked instances will be in the ngrx store for deletion 
Add a sort of hue (red) to indicate that the instance has been deleted 


Updated Instances
An instance that has been modified will appear in the ngrx ‘updated’ store.
Instances marked as updated will be in the store and returned as the original, unmodified database copy. 
When adding new instances to the master list, check that the schema class matches.
Create a hue to indicate 

New Instances 
New instances are contained in the ‘new instances’ store 
Of all new instances, those that have the schema class as that provided as a param should be added to the master list. 
NOT adding to the list, curators can access easily from the status panel 
If curators do not like new instances not being contained, we can add to the top of the list 

Test Cases:
Update an instance, then delete it.
Create a new instance, update, then delete.
Create a new instance. Ensure it only appears in its appropriate schema class list.
Update an instance multiple times ensuring that only the updated copy is displayed (not the database copy) at each update.
Need to check different browsers and tabs so that the lists are synchronized 
