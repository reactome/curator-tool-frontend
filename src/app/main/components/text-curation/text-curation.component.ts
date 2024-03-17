import { Component, input } from '@angular/core';
import { MatLabel } from '@angular/material/form-field';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DataService } from 'src/app/core/services/data.service';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { NewInstanceActions } from 'src/app/instance/state/new-instance/new-instance.actions';
import { MatTooltip } from '@angular/material/tooltip';
import { NgIf } from '@angular/common';
import { Input } from '@angular/core';
import { Instance } from 'src/app/core/models/reactome-instance.model';
import { InstanceTableComponent } from 'src/app/instance/components/instance-view/instance-table/instance-table.component';

@Component({
  selector: 'app-text-curation',
  standalone: true,
  imports: [MatLabel, MatTooltip, NgIf],
  templateUrl: './text-curation.component.html',
  styleUrl: './text-curation.component.scss'
})
export class TextCurationComponent {

  @Input() embedded: boolean = false;
  //TODO: Make sure this component is higher than InstanceTableComponent.
  @Input() instanceTable: InstanceTableComponent | undefined = undefined;

  // Test code: Need to remove it
  chatModel: ChatOpenAI = new ChatOpenAI(
    {
      openAIApiKey: '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',
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
    }
  );

  operationSchema = {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["createNewInstance", "setAttribute", "searchInstance", "editInstance"],
      },
      schemaClassName: { type: "string" },
      attribute: { type: "string" },
      value: { type: "string" },
      dbId: { type: "number"}
    },
    required: ["operation", "schemaClassName", "attribute", "value", "dbId"],
  };

  constructor(private dataSerice: DataService,
    private objectStore: Store,
    private router: Router) { }

  async execute(command: string) {
    console.debug('Execute: ', command);
    const modelWithStructuredOutput = this.chatModel.withStructuredOutput(this.operationSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      ['system',
        `Extract the operations and their related arguements from the user's input below.
        Respond with a JSON object containing required keys:
        'operation': the type of operation to execute.
        if the operation is createNewInstance, provide 'schemaClassName', which is the class name of the new instance.
        If the operation is setAttribute, provide two arguments: attribute for the property name and value for the property
        value. 
        If the operation is editInstance, provide one argument: dbId.
        Make sure the class names and attribute names follow the standard object-oriented class and property naming
        convention using "CAMELCASE", e.g., class names should start with Upper case.
        `
      ],
      ['user', '{command}']
    ]
    );
    const chain = prompt.pipe(modelWithStructuredOutput);
    let answer = await chain.invoke({
      command: command,
    })
    console.debug('Answer: ', answer);
    if (answer['operation'] === 'createNewInstance') {
      if (answer['schemaClassName']) {
        // Need to normalize the class name
        this.createNewInstance(answer['schemaClassName']);
      }
    }
    else if (answer['operation'] === 'editInstance') {
      if (answer['dbId']) {
        this.editInstance(answer['dbId']);
      }
    }
    else if (answer['operation'] === 'setAttribute') {
      this.setAttribute(answer['attribute'], answer['value']);
    }
  }

  //TODO: Copied from schema-class-tree.component.ts. Need refactor to create a new service so that all functions
  // used here can be shared across the whole application.
  createNewInstance(schemaClassName: string) {
    this.dataSerice.createNewInstance(schemaClassName).subscribe(instance => {
      this.dataSerice.registerNewInstance(instance);
      this.objectStore.dispatch(NewInstanceActions.register_new_instances(instance));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/instance_view/" + dbId]);
    });
  }

  editInstance(dbId: number) {
    this.router.navigate(["/instance_view/" + dbId]);
  }

  setAttribute(attribute: string,
               value: any) {
    if (this.instanceTable === undefined || this.instanceTable._instance === undefined) 
      return;
    // Make sure the value is validated
    const instance = this.instanceTable._instance;
    instance.attributes.set(attribute, [value]);
    this.instanceTable.updateTableContent();
    //TODO: This function should be refactor to something related to Instance only, not in the table!
    this.instanceTable.addModifiedAttributeName(attribute);
  }

}

