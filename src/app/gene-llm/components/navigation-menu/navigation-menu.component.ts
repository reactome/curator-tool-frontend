import { ArrayDataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit } from '@angular/core';
import { MatTreeFlattener, MatTreeFlatDataSource } from '@angular/material/tree';
import { SchemaClass } from 'src/app/core/models/reactome-schema.model';

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent implements OnInit{

  ngOnInit(): void {
    console.log('dataSource', this.dataSource);
  }

  scrollToSection(id: string) {
    // wait a moment to ensure the view has rendered (if necessary)
    setTimeout(() => {
      const section = document.getElementById(id);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  childrenAccessor = (node: MenuNode) => node.children ?? [];

  dataSource = EXAMPLE_DATA;

  // private _transformer = (node: NodeData) => {
  //   return {
  //     name: node.name,
  //     // children: node.children,
  //     level: node.level,
  //     expandable: !!node.children && node.children.length > 0,
  //   };
  // };

  // hasChild = (_: number, node: MenuNode) => !!node.children && node.children.length
  
  //   treeControl = new FlatTreeControl<MenuNode>(
  //     node => node.level,
  //     node => node.expandable!,
  //   );
  
  //   treeFlattener = new MatTreeFlattener(
  //     this._transformer,
  //     (node: MenuNode) => node.level,
  //     (node: MenuNode) => node.expandable,
  //     // required by API
  //     (menuNode: NodeData) => menuNode.children ?? [],
  //   );


    //dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  }


const EXAMPLE_DATA: NodeData[] = [
  {
    name: "Annotated Pathways",
    children: [ {
      name: 'Summary',
      id: 'pathway_content'
    },
    {
      name: 'Pathway Details',
      id: 'pathway_details',
      children: [
        {
          name: 'Pathway 1',
        },
        {
          name: 'Pathway 2',
        },
      ],
    },]
  },
  {
    name: "Predicted Pathways",
    id: 'gene2PPi',
    children: [  {
      name: 'Pathway 1',
    },
    {
      name: 'Pathway 2',
    },
    {
      name: 'Pathway 3',
    },]
  }
];


  /** Flat node with expandable and level information */
  interface MenuNode {
    name: string;
    children?: MenuNode[];
    expandable: boolean;
    level: number;
  }

  interface NodeData {
    name: string;
    children?: NodeData[];
    id?: string;
  }
