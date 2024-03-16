import { Component } from '@angular/core';
import { MatLabel } from '@angular/material/form-field';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DataService } from 'src/app/core/services/data.service';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { NewInstanceActions } from 'src/app/instance/state/new-instance/new-instance.actions';

@Component({
  selector: 'app-text-curation',
  standalone: true,
  imports: [MatLabel],
  templateUrl: './text-curation.component.html',
  styleUrl: './text-curation.component.scss'
})
export class TextCurationComponent {

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
    },
    required: ["operation", "schemaClassName", "attribute", "value"],
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
        value. Make sure the class names and attribute names follow the standard object-oriented class and property naming
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

}

