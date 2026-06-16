import { NgModule } from "@angular/core";
import { PathwayDiagramUtilService } from "./utils/pathway-diagram-utils";
import { PathwayDiagramValidator } from "./utils/pathway-diagram-validator";
import { InstanceConverter } from "./utils/instance-converter";
import { DiagramEditorService } from "./utils/diagram-editor.service";

@NgModule({
providers: [
    PathwayDiagramUtilService,
    PathwayDiagramValidator,
    InstanceConverter,
    DiagramEditorService
]
})
export class PathwayDiagramModule{}