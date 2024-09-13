import { NgModule } from "@angular/core";
import { PathwayDiagramUtilService } from "./utils/pathway-diagram-utils";
import { PathwayDiagramValidator } from "./utils/pathway-diagram-validator";
import { InstanceConverter } from "./utils/instance-converter";

@NgModule({
providers: [
    PathwayDiagramUtilService,
    PathwayDiagramValidator
]
})
export class PathwayDiagramModule{}