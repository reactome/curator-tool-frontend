import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatLabel } from '@angular/material/form-field';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from '@langchain/openai';
import { Store } from '@ngrx/store';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from 'langchain/hub';
import { DataService } from 'src/app/core/services/data.service';
import { InstanceTableComponent } from 'src/app/schema-view/instance/components/instance-view/instance-table/instance-table.component';
import { NewInstanceActions } from 'src/app/schema-view/instance/state/new-instance/new-instance.actions';
import { z } from "zod";

import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";

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
      openAIApiKey: '{}', // This is needed. Right now it is hard-coded. To be pulled from the server-side.
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

  // The following implementation is based on:
  // https://js.langchain.com/docs/modules/agents/tools/dynamic
  async execute(command: string) {
    console.debug('Execute: ', command);
    // These tools may work together sequentially. Need to figure out how to leverage
    // this powerful feature in the current curator tool (i.e. we need a better software archutecture).
    const tools = [
      new DynamicStructuredTool({
        name: "createNewInstance",
        description: "Create a new instance for the specificed class.",
        schema: z.object({
          schemaClassName: z.string().describe('The schema class name of the new instance'),
        }),
        func: async ({schemaClassName}) => {
          this.createNewInstance(schemaClassName);
          return 'a new instance is created.';
        },
      }),
      new DynamicStructuredTool({
        name: "setAttribute",
        description: "Set the attribute value for the displayed instance",
        schema: z.object({
          attributeName: z.string().describe("The attribute name"),
          value: z.any().describe("The attribute value"),
        }),
        func: async ({ attributeName, value }) => {
          console.debug('Attriute name: ', attributeName, 'value: ', value);
          this.setAttribute(attributeName, value);
          return 'assign attribute done';
        },
      }),
      new DynamicStructuredTool({
        name: "editInstance",
        description: "Open the instance specified by its dbId for editing",
        schema: z.object({
          dbId: z.number().describe("The dbId of the instance to be edited"),
        }),
        func: async ({dbId}) => {
          console.debug('Instance to be edited: ', dbId);
          this.editInstance(dbId);
          return "instance view opened";
        },
      }),
    ];
    // Get the prompt to use - you can modify this!\
    // If you want to see the prompt in full, you can at:
    // https://smith.langchain.com/hub/hwchase17/openai-functions-agent
    const prompt = await pull<ChatPromptTemplate>(
      "hwchase17/openai-functions-agent"
    );
    const llm = this.chatModel;
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
    });

    const result = await agentExecutor.invoke({
      input: command,
    });

    console.debug("Got output ", result['output']);
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

