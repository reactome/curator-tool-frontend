import {AsyncPipe, NgForOf, NgIf} from '@angular/common';
import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatTooltip} from '@angular/material/tooltip';
import {Router} from '@angular/router';
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {ChatOpenAI} from '@langchain/openai';
import {Store} from '@ngrx/store';
import {AgentExecutor, createOpenAIFunctionsAgent} from "langchain/agents";
import {pull} from 'langchain/hub';
import {AttributeDataType, SchemaAttribute} from 'src/app/core/models/reactome-schema.model';
import {DataService} from 'src/app/core/services/data.service';
import {
  InstanceTableComponent
} from 'src/app/instance/components/instance-view/instance-table/instance-table.component';
import {NewInstanceActions} from "src/app/instance/state/instance.actions";
import {z} from "zod";

import {HttpClient} from '@angular/common/http';
import {DynamicStructuredTool} from "@langchain/core/tools";
import {Instance} from 'src/app/core/models/reactome-instance.model';
import {InstanceViewComponent} from 'src/app/instance/components/instance-view/instance-view.component';
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {Observable, startWith, async} from "rxjs";
import {map} from "rxjs/operators";
import {MatInput} from "@angular/material/input";
import {MatMenu, MatMenuItem, MatMenuTrigger} from "@angular/material/menu";
import {MatButton} from "@angular/material/button";

@Component({
  selector: 'app-text-curation',
  standalone: true,
  imports: [MatLabel, MatTooltip, NgIf, MatFormField, MatAutocomplete, ReactiveFormsModule, MatAutocompleteTrigger, MatOption, NgForOf, MatInput, AsyncPipe, MatMenuTrigger, MatMenu, MatMenuItem, MatButton],
  templateUrl: './text-curation.component.html',
  styleUrl: './text-curation.component.scss',
})
export class TextCurationComponent implements OnInit {

  @Input() embedded: boolean = false;
  //Instead of refer to a table, here we refer to the view to avoid NG0100 error: view changed after checking!
  // But this may need to be refactored in the future.
  @Input() instanceView: InstanceViewComponent | undefined;

  @Input() set instance(instance: Instance | undefined) {
    if (instance) {
      this.attributeList = instance.schemaClass?.attributes ? instance.schemaClass?.attributes : [];
    }
  }

  // Test code: Need to remove it
  chatModel: ChatOpenAI | undefined = undefined;

  operationSchema = {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["createNewInstance", "setAttribute", "searchInstance", "editInstance"],
      },
      schemaClassName: {type: "string"},
      attribute: {type: "string"},
      value: {type: "string"},
      dbId: {type: "number"}
    },
    required: ["operation", "schemaClassName", "attribute", "value", "dbId"],
  };
  commandControl = new FormControl<string>('');
  attributeControl = new FormControl<string | SchemaAttribute>('');
  commandList: string[] = ['set', 'create', 'delete'];
  filteredCommandList: Observable<string[]> = new Observable<string[]>();
  attributeList: SchemaAttribute[] = [];
  filteredAttributeList: Observable<SchemaAttribute[]> = new Observable<SchemaAttribute[]>();


  constructor(private dataService: DataService,
              private objectStore: Store,
              private router: Router,
              private http: HttpClient) {
    // Fetch OpenAI API key
    // const llm_url_openai_key = 'http://127.0.0.1:5000/openai_key';
    // this.http.get(llm_url_openai_key, {responseType: 'text'}).subscribe(result => {
    //   this.chatModel = new ChatOpenAI(
    //     {
    //       openAIApiKey: result,
    //       modelName: 'gpt-3.5-turbo',
    //       temperature: 0,
    //     }
    //   )
    // });
  }

  ngOnInit() {
    this.filteredAttributeList = this.attributeControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.attributeList?.slice();
      }),
    );

    this.filteredCommandList = this.commandControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        return this._commandFilter(value!)
      })
    )

  }

  displayCommands(command: string): string {
    return command ? command : '';
  }
  displayAttributes(attribute: SchemaAttribute): string {
    return attribute && attribute.name ? attribute.name : '';
  }

  private _filter(attribute: string) {
    const filterValue = attribute.toLowerCase();

    return this.attributeList?.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  private _commandFilter(command: string) {
    const filterValue = command.toLowerCase();

    return this.commandList.filter(option => option.toLowerCase().includes(filterValue));
  }

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
        name: "setAttributeValue",
        description: "Set the attribute value for the displayed instance based on the attribute name.",
        schema: z.object({
          attributeName: z.string().describe("The attribute name"),
          value: z.any().describe("The attribute value"),
        }),
        func: async ({attributeName, value}) => {
          console.debug('Attriute name: ', attributeName, 'value: ', value);
          this.setAttribute(attributeName, value);
          return 'assign attribute done';
        },
      }),
      new DynamicStructuredTool({
        name: "addAttributeValue",
        description: "Add the attribute value for the displayed instance based on the attribute name.",
        schema: z.object({
          attributeName: z.string().describe("The attribute name"),
          value: z.any().describe("The attribute value"),
        }),
        func: async ({attributeName, value}) => {
          console.debug('Attriute name: ', attributeName, 'value: ', value);
          this.setAttribute(attributeName, value, true);
          return 'assign attribute done';
        },
      }),
      new DynamicStructuredTool({
        name: "editInstance",
        description: "Open the instance specified by its dbId for editing or display name and class name",
        schema: z.object({
          dbId: z.number().describe("The dbId of the instance to be edited")
          // className: z.string().optional().describe('The className of the instance to be edited'),
          // displayName: z.string().optional().describe('The displayName of the instance to be edited')
        }),
        func: async ({dbId}) => {
          console.debug('Instance to be edited: ', dbId);
          this.editInstance(dbId);
          return "instance view opened";
        },
      }),
    ];
    // Get the prompt to use - you can modify this!
    // If you want to see the prompt in full, you can at:
    // https://smith.langchain.com/hub/hwchase17/openai-functions-agent
    //TODO: Have to find a way to customize this by inject something to system!
    let prompt = await pull<ChatPromptTemplate>(
      "hwchase17/openai-functions-agent"
    );

    //     const prompt = ChatPromptTemplate.fromTemplate("SYSTEM: Extract verbs first and map these verbs to functions \
    // as following: set -> setAttribute, create -> createNewInstance, edit -> editInstance. Do not \
    // call any functions that are not mentioned in the command. If you find a class name but no create,\
    // don't invoke createNewInstance! For the schema class name found for createNewInstance, format it \
    // into UpperCamelCase, with the first letter of every word capitalized. Don't do this format for other functions.\
    // \n\nHUMAN: {input}\n\n{agent_scratchpad}");

    const llm = this.chatModel!;
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

    // Need to add something to limit the function.
    // The following cannot work. Need a short and very succint instruction!
    //     let input = "command: " + command + "\n\n" + "Important note: Use the verb in the command only to find function. Don't use any verb not in the command. \
    // If you find a class name but no creation, don't invoke createNewInstance! For the schema \
    // class name found for createNewInstance, format it \
    // into UpperCamelCase, with the first letter of every word capitalized. Don't do this format for other functions. The output should be just the found function and parametmers. Nothing else!";
    // let input = command;
    // Cannot add too much text here. Otherwise, LLM will also output too much information the function cannot be called.
    let input = "command: " + command + "\n\n" + "Important note: Don't call createNewInstance for set or add!";
    const result = await agentExecutor.invoke({
      input: input,
    });

    console.debug("Got output ", result['output']);
  }

  //TODO: Copied from schema-class-tree.component.ts. Need refactor to create a new service so that all functions
  // used here can be shared across the whole application.
  createNewInstance(schemaClassName: string) {
    this.dataService.createNewInstance(schemaClassName).subscribe(instance => {
      this.dataService.registerNewInstance(instance);
      this.objectStore.dispatch(NewInstanceActions.register_new_instance(instance));
      let dbId = instance.dbId.toString();
      this.router.navigate(["/schema_view/instance/" + dbId]);
    });
  }

  editInstance(dbId: number) {
    if (dbId !== undefined)
      this.router.navigate(["/schema_view/instance/" + dbId]);
  }

  setAttribute(attribute: string, value: any, append: boolean = false) {
    if (this.instanceView!.instanceTable === undefined || this.instanceView!.instanceTable._instance === undefined)
      return;
    // Make sure the value is validated
    const instance = this.instanceView!.instanceTable._instance;
    this.attributeList = instance.attributes;
    // Determinte if the attribute is an instance type
    const clsAtt = this.getClassAttribute(attribute, instance);
    if (clsAtt === undefined) return;
    if (clsAtt.type !== AttributeDataType.INSTANCE) {
      if (clsAtt.cardinality === '1')
        instance.attributes.set(attribute, value);
      else {
        if (append) {
          let values = instance.attributes.get(attribute);
          if (values)
            values.push(value);
          else
            instance.attributes.set(attribute, [value]);
        } else
          instance.attributes.set(attribute, [value]);
      }
      this.validateTable(attribute, [value]);
    } else {
      this.setInstanceAttribute(clsAtt, value, instance, append);
    }
  }

  private validateTable(attributeName: string,
                        attributeValue: any
  ) {
    if (this.instanceView!.instanceTable === undefined) return;
    this.instanceView!.instanceTable.finishEdit(attributeName, attributeValue);
  }

  /**
   * Find an instance that matches display name as passed or dbId.
   * @param clsAtt
   * @param value
   * @returns
   */
  private setInstanceAttribute(clsAtt: SchemaAttribute,
                               value: string,
                               instance: Instance,
                               append: boolean = false) {
    if (typeof value === 'number') {
      // This should be a DB_ID of the instance
      const dbId = value as number;
      this.dataService.fetchInstance(dbId).subscribe(attInst => {
        this._setInstanceAttribute(instance, clsAtt, attInst, append);
      });
    } else { // display name is assumed
      this.dataService.findInstanceByDisplayName(value, clsAtt.allowedClases!).subscribe(attInst => {
        this._setInstanceAttribute(instance, clsAtt, attInst, append);
      })
    }
  }

  // A helper function to set the instance type of attribute actually.
  private _setInstanceAttribute(instance: Instance,
                                clsAtt: SchemaAttribute,
                                attInst: Instance,
                                append: boolean = false) {
    if (attInst === undefined)
      return;
    // We just need the following information for an instance value
    const attValue = {
      dbId: attInst.dbId,
      displayName: attInst.displayName,
      schemaClassName: attInst.schemaClassName
    }
    if (clsAtt.cardinality == '1')
      instance.attributes.set(clsAtt.name, attValue);
    else {
      if (append) {
        let values = instance.attributes.get(clsAtt.name);
        if (values)
          values.push(attValue);
        else
          instance.attributes.set(clsAtt.name, [attValue]);
      } else
        instance.attributes.set(clsAtt.name, [attValue]);
    }
    this.validateTable(clsAtt.name, attValue);
  }

  /**
   * Perform a linear search to find the attribute defined in the instance's class.
   * @param attName
   * @param instance
   * @returns
   */
  private getClassAttribute(attName: string,
                            instance: Instance): SchemaAttribute | undefined {
    if (instance.schemaClass?.attributes) {
      for (let att of instance.schemaClass?.attributes) {
        if (att.name === attName) {
          return att;
        }
      }
    }
    return undefined;
  }

  checkInput(command: string): boolean {
    return true;
  }
}

