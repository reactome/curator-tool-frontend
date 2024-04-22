import { ChangeDetectorRef, Component, OnInit, ViewChild, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { ActivatedRoute, Router } from "@angular/router";
import { DataService } from 'src/app/core/services/data.service';
import { Graph } from '@antv/g6';

@Component({
  selector: 'app-event-plot',
  templateUrl: './event-plot.component.html',
  styleUrls: ['./event-plot.component.scss'],
})

export class EventPlotComponent {
  title: string = '';

  fillColors = new Map(Object.entries({
      'DefinedSet':'#9cf7ba',
      'CandidateSet':'#9cf7ba',
      'Protein':'#9cf7ba',
      'RNA':'#9cf7ba',
      'Gene':'#000000',
      'DummyCentral':'#ffffff',
      'DummyIO':'#ffffff',
      'Compound': '#9cf7ba',
      'Complex': '#9cebf7',
      'OtherEntity': '#9cf7ba',
      'Pathway': '#9cf7ba',
      'Reaction': '#9cf7ba'
  }));

  nodeStyleRadii = new Map(Object.entries({
      'DefinedSet':7,
      'CandidateSet':7,
      'Protein': 7,
      'RNA': 17,
      'Complex': 7,
      'Compound': 11,
      'Reaction': 11
  }));

  shapes = new Map(Object.entries({
        'DefinedSet':'rect',
        'CandidateSet':'rect',
        'Protein':'rect',
        'RNA':'rect',
        'Gene':'rect',
        'DummyCentral':'rect',
        'DummyIO':'circle',
        'Compound': 'ellipse',
        'Complex': 'rect',
        'OtherEntity': 'rect',
        'Pathway': 'rect',
        'Reaction': 'ellipse'
    }));


  nodeSizes = new Map(Object.entries({
      'DefinedSet':[30,20],
      'CandidateSet':[30,20],
      'Protein':[30,20],
      'RNA':[40,20],
      'Gene':[30,4],
      'DummyCentral':[20,20],
      'DummyIO':[2,2],
      'Compound':[30,20],
      'Complex':[30,20],
      'OtherEntity':[30,20],
      'Pathway': [30,20],
      'BlackBoxEvent': [30,20],
      'Reaction': [30,20]
  }));

  edgeEndShapes = new Map(Object.entries({
    "black_arrow" : {
          path: 'M 0,0 L 8,4 L 8,-4 Z',
          fill: '#000000' },
    "white_arrow" : {
          path: 'M 0,0 L 8,4 L 8,-4 Z',
          fill: '#FFFFFF' },
    "circle" : {
          path: 'M 0,0 a 6,6 0 1,0 12,0 a 6,6 0 1,0 -12,0',
          fill: '#FFFFFF' },
    "pipe" : {
          path: 'M -10,-2 l 20,0 l 0,2 l -20, 0',
          fill: '#000000'
        }
  }));

  constructor(private router: Router,
              private route: ActivatedRoute,
              private dataService: DataService
             ) {
  }

  @Input() dbIdAndClassName: string = "";
  @Output() updateEventTreeFromPlotSelection = new EventEmitter<string>();

  ngOnChanges() {
    if (this.dbIdAndClassName) {
      this.generatePlot(this.dbIdAndClassName);
    }
  }

  generatePlot(dbIdAndClassName: string): void {
    let dbId = parseInt(dbIdAndClassName.split(":")[0]);
    let className = dbIdAndClassName.split(":")[1];
    let plotType;
    if (className === 'Reaction') {
      plotType = "reaction";
    } else {
      plotType = "hierarchical";
    }
    this.title = this.setTitle(dbId.toString());
    this.dataService.fetchEventPlotData(dbId, plotType).subscribe((data) => {
      const container = document.getElementById('event_plot');
      container!.innerHTML = "";
      const graph = new Graph({
        container: 'event_plot',
        width: 1000,
        height: 1000,
        fitViewPadding: 0,
        fitView: true,
        modes: {
          // Note that on Chrome, moving nodes via drag-canvas, zoom-canvas and drag-node leaves trail of characters
          // (coming from the nodes label) - this is a Chrome bug, as Firefox and Safari work just fine.
          default: ['drag-canvas', 'zoom-canvas', 'click-select','drag-node',
          {
            type: 'tooltip',
            formatText: function formatText(model: any) {
              return model.description;
            },
            offset: 20
          }]
        },
        nodeStateStyles: {
          // The state styles taking effect on keyShape only
          hover: {
            fillOpacity: 0.1,
            lineWidth: 3,
          }
        },
        layout: {
          type: 'dagre',
          nodeSize: [40, 20],
          nodesep: 40,
          ranksep: 40,
          rankdir: 'LR',
          // rankdir: 'TB',
          align: 'UR'
        },
        animate: true,
        defaultNode: {
          size: [40, 20],
          type: 'rect',
          style: {
            lineWidth: 1,
            stroke: '#5B8FF9',
            fill: '#C6E5FF',
          },
        },
        defaultEdge: {
          size: 1,
          color: '#141414',
          type: "cubic-horizontal",
          style: {
            endArrow: {
              // black arrow
              path: 'M 0,0 L 8,4 L 8,-4 Z',
              fill: '#000000',
            },
          },
          labelCfg: {
            autoRotate: true,
            style: {
              opacity: 0.8
            }
          }
        }
      });

      // Convert json to an object
      const dataMap: Map<string, Array<Node | Edge>> = new Map(Object.entries(data));
      const nodes = dataMap.get('nodes') as Array<Node>;
      const edges = dataMap.get('edges') as Array<Edge>;

      if (nodes !== undefined) {
        nodes.forEach(node => {
          if (!node.style) {
            node.style = {}; // graph.cfg.defaultNode.style;
          }
          node.shape = this.shapes.get(node.class);
          node.style.fill = this.fillColors.get(node.class);
          node.labelCfg = {};
          node.labelCfg.style = {};
          node.style.radius = this.nodeStyleRadii.get(node.class);
          node.size = this.nodeSizes.get(node.class);
          node.labelCfg.position = 'bottom';
          node.style.lineWidth = this.nodeStyleLineWidths(node.class);

          if (node.id === "0") {
            node.anchorPoints = [
                [0.5, 0], // input
                [0, 0.3], // catalyst activity
                [0.5, 1], // positive regulation
                [0, 0.9], // negative regulation
                [1, 0.5], // sourceAnchor for output
              ]
          }
        });
      }

      // Traverse the edges data
      if (edges !== undefined) {
        edges.forEach(edge => {
          if (edge.source == edge.target) {
            edge.type = "loop";
          }
          if (!edge.style) {
            edge.style = {};
          }
          edge.style.endArrow = edge.edgeEndShape ? this.edgeEndShapes.get(edge.edgeEndShape): "";
          edge.label = edge.stoichiometry;
        });
      }

      graph.data(data);
      graph.render();

      // Listen to the mouse enter event on node
      graph.on('node:mouseenter', evt => {
        const node = evt.item;
        // activate the hover state of the node
        graph.setItemState(node!, 'hover', true);
      });
      // Listen to the mouse leave event on node
      graph.on('node:mouseleave', evt => {
        const node = evt.item;
        // inactivate the hover state of the node
        graph.setItemState(node!, 'hover', false);
      });
      // Click on node
      graph.on('node:click', evt => {
        const node = evt.item;
        const plotParams = node!._cfg!.model!['plotParams'] as string;
        // Passing the event with the selected plot dbId:ClassName (plotParams)
        // as well as the original one (dbIdAndClassName) - so that event tree node
        // corresponding to the original one can be expanded - in order to show
        // the selected one.
        this.updateEventTreeFromPlotSelection.emit(plotParams + "," + dbIdAndClassName);
      });
    });
  }

  setTitle(title: string): string {
    return title;
  }

  nodeStyleLineWidths(className: string): number {
    if (className === "DefinedSet" || className === "CandidateSet" || className === "Pathway") {
      return 4;
    }
    return 1;
  }
}

interface Node {
    id: string;
    class: string;
    description?: string;
    label?: string;
    instanceViewUrl?: string;
    plotUrl?: string;
    style?: any;
    shape?: string
    labelCfg?: any;
    size?: number[];
    anchorPoints?: Array<Array<number>>;
}

interface Edge {
  width: number;
  source: string;
  target: string;
  stoichiometry?: string;
  sourceAnchor?: string;
  targetAnchor?: string;
  edgeEndShape?: string;
  style?: any;
  type?: string
  label?: string
}

