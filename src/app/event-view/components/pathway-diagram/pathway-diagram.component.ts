/**
 * This component is a wrapper of cr-diagram to provide features for editing the pathway diagram that is displayed
 * in cytoscape. 
 */
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DiagramComponent } from 'ngx-reactome-diagram';
import { delay, map } from 'rxjs';
import { EditorActionsComponent } from './editor-actions/editor-actions.component';
import { PathwayDiagramUtilService } from './pathway-diagram-utils';

@Component({
  selector: 'app-pathway-diagram',
  standalone: true,
  imports: [DiagramComponent, CommonModule, EditorActionsComponent],
  templateUrl: './pathway-diagram.component.html',
  styleUrl: './pathway-diagram.component.scss',
  providers: [PathwayDiagramUtilService]
})
export class PathwayDiagramComponent implements AfterViewInit {

  id$ = this.route.params.pipe(
    map(params => params['id'])
  )
  @ViewChild('diagramComponent')
  diagram!: DiagramComponent;

  // Try to control the popup menu
  showMenu: boolean = false;
  menuPositionX: string = "0px";
  menuPositionY: string = "0px";

  renderedEdges: any;

  constructor(private route: ActivatedRoute,
    private diagramUtils: PathwayDiagramUtilService
  ){
  }

  ngAfterViewInit(): void {
    this.id$.pipe(delay(500)).subscribe(id => {
      this.diagram.cy.nodes().grabify().unpanify();
      this.diagram.cy.nodes('.Compartment').panify();
      // Have to add the following to zoom using mouse scroll. 
      this.diagram.cy.zoomingEnabled(true);
      this.diagram.cy.userZoomingEnabled(true);
      this.diagram.cy.panningEnabled(true);
      this.diagram.cy.userPanningEnabled(true);
      // May need to use cxtapstart or end for Safari. Apparently cxttap cannot work with Safari!
      // this.diagram.cy.nodes().on('cxttapstart', (e:any) => {
      //   this.showCyPopup(e);
      // });
      this.diagram.cy.edges().on('cxttapstart', (e:any) => {
        this.showCyPopup(e);
      });
      this.diagram.cy.on('cxttapstart', (e:any) => {
        this.showCyPopup(e);
      });
      this.diagram.cy.on('mousedown', (e: any) => {
        if (this.showMenu) {
          this.showMenu = false;
          e.preventDefault();
        }
      });
    })
  }

  private showCyPopup(event: any) { // Use any to avoid any compiling error
    // The offset set 5px is important to prevent the native popup menu appear
    this.menuPositionX = (event.renderedPosition.x + 5) + "px";
    this.menuPositionY = (event.renderedPosition.y + 5) + "px";
    this.showMenu = true;
  }

  onAction(action: string) {
    console.debug('action is fired: ' + action);
    if (action === 'enableEditing')
      this.diagramUtils.enableEditing(this.diagram);
    this.showMenu = false;
  }

}

