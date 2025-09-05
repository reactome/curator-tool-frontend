# Batch Editing

TODO: test different browsers and tabs for synchronized

## Instance Attribute

### Single Valued

#### Replace via Creation

- Display the aggregated values for the attribute of the instances in the batch-editing list.
- On “OK” display the dialog for creating a new instance.
- On “OK” from the new instance dialog, iterate through the instances from the batch-edit list. If the attribute for an instance is equal to any of the selected values, replace it with the newly created instance.

#### Replace via Selection

- Display the aggregated values for the attribute of the instances in the batch-editing list.
- On “OK” display the dialog for instance selection.
- On “OK” from the instance selection dialog (only one value for single valued, and allow multi-selection for multi-valued) save values and iterate through the instance list from the batch-editing. If any values are equal to those selected from the aggregated value list, replace them with the selected value(s).

#### Deletion

- Display the aggregated values for the attribute to type to be deleted
- Collect the user-selected values from the aggregated list
- For each instance in the batch-editing list, check if the selected attribute type contains any of the values from the user-selected value, if yes then remove the value

### Multi-Valued (plus single valued options)

#### Add via Creation

- Display the dialog for creating a new instance
- On “OK” add the new instance to the end of the list of instance values for this attribute

#### Add via Selection

- Display the dialog to select an existing instance(s) from the list
- On “OK” add the new instance to the end of the list of instance values for this attribute

## Text Attribute & Numeric Attribute (int and float)

### Add New Text

- If the attribute is multi-valued, add new text to the end of the list of values. Only display the ‘replace text’ option
- When ‘new text’ is selected, display a text box to enter the new text.

### Replace Text

- Display the list of aggregated values for the attribute that was selected to edit.
- Afterwards display a text area to collect the new text.
- Iterate through the list of instances in the batch edit list. For an instance, if its attribute contains the user-selected text values, replace these with the new text.

### Deletion

- Display the list of aggregated values for the attribute that was selected to edit.
- Iterating through the list of the instances in the batch edit list, if the instance has an attribute which value is equal to that of what was selected from the list, delete this value.

## Boolean Attribute

- True
- False
- Undefined
