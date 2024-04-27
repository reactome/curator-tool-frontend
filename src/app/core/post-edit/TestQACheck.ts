import { concatMap } from "rxjs";
import { Instance } from "../models/reactome-instance.model";
import { DataService } from "../services/data.service";
import { InstanceNameGenerator } from "./InstanceNameGenerator";
import { PostEditListener, PostEditOperation } from "./PostEditOperation";
import { SchemaClass } from "../models/reactome-schema.model";
import { NewInstanceActions } from "src/app/schema-view/instance/state/instance.actions";

export class TestQACheck implements PostEditOperation {

    constructor(private dataService: DataService, private checkType: string) {
    }

    postEdit(instance: Instance,
             editedAttributeName: string | undefined,
             postEditListener: PostEditListener | undefined): boolean {

       let editedAttributeNames: string[] = [];
       let editedAttributeValues: string[] = [];
       if (instance.modifiedAttributes !== undefined) {
         instance.modifiedAttributes.forEach((attr: string) => {
           editedAttributeNames.push(attr);
           let new_val = instance.attributes.get(attr);
           editedAttributeValues.push(new_val != null ? new_val : "null");
         });
       }

       this.dataService.testQACheckReport(
              instance.dbId,
              this.checkType,
              editedAttributeNames.toString(),
              editedAttributeValues.toString())
          .subscribe(data => {
          if (instance.qaIssues === undefined) {
            instance.qaIssues = new Map();
          }
          let key = "TestQA" + this.checkType;
          instance.qaIssues.set(key, data);
          if (instance.qaIssues.get(key)!.length === 0) {
              instance.qaIssues.delete(key);
          }
          // console.debug(instance.qaIssues);
          if (postEditListener)
              postEditListener.donePostEdit(instance, editedAttributeName);

       });
        return true;
    }
}
