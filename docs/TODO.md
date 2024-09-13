#### Bugs:
- After the browser starts or refreshed, click an instance in the changes tab switches to the schema tree. It should be stay at the changes tab.
- Make sure the diagram is in editing disabled state when uploading to the server or disable editing when loading back.

#### TODO:
- Make sure a simple text slot (e.g. name) can add new value: the added value is not added as a new line.
- Change the main component into schema view: so that we can add an event view.
- Need to style the detailed table view for schema class.
- refactoring the routes by following https://angular.io/guide/router#getting-route-information: Make sure we have different layers of routers: schema view, event view, llms, and others, each of which should mamange its own routes.
- The height of the instance view is not quite right: The scrollbar is there even with a very small instance (instance has a short list of attributes).
- Make sure the layout doesn't change for some instances: e.g. 141426
- isCanonocal in Pathway cannot be edited
- the allowed type for the modification slot in ModifiedNucleotide is DatabaseObject. However, only four classes are defined.
- bug: regulation is not defined in RegulationReference. It is regulatedBy in the Java class model.
- bug: If the user does a refresh, any edit will get lost!
- bug: list all DatabaseIdentifier instances: cannot nagivate to the last page directly!
- Scroll the schema tree to the bottom, select a class to list instances. The tree scroll back to the top automatically. This is not good. This applies to display the instance table too. 
- bug: the layout is broken when compare EGFR (ReferenceGeneProduct) vs db after making a little bit edit: too much text in the comment slot.
- Make sure to use undefined, not null, to make the coed consistent. Check with the table editing results. Right now: text returns "" and non-text returns null!
- Check why InstanceEdit doesn't have author, dateTime or other slots. Also check its _displayName works!
- bug: PathwayDiagram is not listed in the schema tree! Also check its display name generation.
- bug: The registed new instances' in changes display names don't get updated!
- bug: There are multiple places to create a new instance and then regist it. However, the new instances table in the changes tab doesn't get updated!
- Deletion of instances (existing or new) is not supported yet.
- Merge the following two states together, new-instance to instance:
import {newInstances} from "../../../schema-view/instance/state/new-instance/new-instance.selectors";
import { updatedInstances } from 'src/app/schema-view/instance/state/instance.selectors';
- Bug: After filtering to changed only attribute in the comparison table, turn off the comparison. There is no way to show the whole table now.
- bug: In the updated instances table, when the display name is really long, no action buttons can be seen.
- todo: how to handle label of the compartment? In the editing mode, make compartment movable. However, we have to disable resizing and then make sure the two layers are posititioned correctly.
- bug: the layers of compartment are not right now. Some compartments cannot get selected: http://localhost:4200/event_view/instance/157858, inside compartments, caused by the order of plotting compartments. This needs to be fixed.
- TODO: Set the color of icons in the event tree for dark mode. Right now, they are all black, which cannot be seen in the dark mode.
- Make sure the disease pathway diagram is correct. Right not it is not!
- Need some big refactoring for classes in the pathway diagram module: Right now they are all cross-linked together, espect to diagram service utils.

#### Notes:
- the following version or configuration are important for compiling: "@langchain/openai": "^0.0.12" (March 14, 2024) in package.json and "skipLibCheck": true in tsconfig.json, // Based on to fix langchain issue:https://github.com/langchain-ai/langchainjs/issues/3793
- To build an angular component, follow https://www.telerik.com/blogs/angular-component-library-part-1-how-to-build. The pack is very important. Otherwise, it will not work! To install the component from reactome's ngx project, use: npm i {path_to_the_component} (e.g. ../ngx-reactome-base/dist/ngx-reactome-diagram/ngx-reactome-diagram-0.0.16.tgz). Note: make sure the version updated. Otherwise, the loaded library will not be updated in the chrome debug!!!

