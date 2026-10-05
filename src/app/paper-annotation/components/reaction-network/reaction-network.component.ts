import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Core } from 'cytoscape';
import { Network } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { NetworkLayoutStore } from './network-layout.store';
import { EDGE_LEGEND, STYLE, cytoscape, neighbours, toElements } from './network-elements';

/**
 * Every extracted reaction and the entities it involves, as one network (Cytoscape). Click an entity to see which
 * reactions it takes part in; click a reaction to select it (double-click opens its details).
 */
@Component({
  selector: 'app-reaction-network',
  templateUrl: './reaction-network.component.html',
  styleUrls: ['./reaction-network.component.scss']
})
export class ReactionNetworkComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) sessionId!: string;
  /** Changes when the draft may have changed (an accepted edit, QA); the network reloads. */
  @Input() stamp = 0;
  @Input() selectedKey: string | null = null;
  @Output() reactionSelected = new EventEmitter<string>();
  @Output() reactionOpened = new EventEmitter<string>();

  @ViewChild('canvas') canvas!: ElementRef<HTMLDivElement>;

  readonly legend = EDGE_LEGEND;
  network: Network | null = null;
  loading = false;
  error: string | null = null;
  /** Entity whose reactions are highlighted, if any. */
  focusLabel: string | null = null;

  private cy: Core | null = null;
  private viewReady = false;

  constructor(private api: LlmApiService, private layouts: NetworkLayoutStore) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.draw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] || changes['stamp']) this.load();
    else if (changes['selectedKey']) this.markSelected();
  }

  ngOnDestroy(): void {
    this.remember();
    this.cy?.destroy();
  }

  get empty(): boolean {
    return !!this.network && this.network.nodes.length === 0;
  }

  private load(): void {
    this.loading = true;
    this.api.network(this.sessionId).subscribe({
      next: n => { this.network = n; this.error = null; this.loading = false; this.draw(); },
      error: (e: LlmApiError) => { this.error = e.message; this.loading = false; }
    });
  }

  private draw(): void {
    if (!this.viewReady || !this.network) return;
    this.remember();
    this.cy?.destroy();
    this.focusLabel = null;
    const net = this.network;
    const cy = this.cy = cytoscape({
      container: this.canvas.nativeElement, elements: toElements(net), style: STYLE,
      wheelSensitivity: .3, minZoom: .1, maxZoom: 3
    });
    cy.on('tap', 'node.entity', e => this.focus(net, e.target.id(), e.target.data('label')));
    cy.on('tap', 'node.reaction', e => { this.focus(net, e.target.id(), null); this.reactionSelected.emit(e.target.data('key')); });
    cy.on('dbltap', 'node.reaction', e => this.reactionOpened.emit(e.target.data('key')));
    cy.on('tap', e => { if (e.target === cy) this.focus(net, null, null); });
    if (!this.restore(net)) this.layout();
    this.markSelected();
  }

  /** Keep the arrangement as it is now, to be put back when the graph is drawn again. */
  private remember(): void {
    const cy = this.cy;
    if (!cy || cy.nodes().length === 0) return;
    const positions: Record<string, { x: number; y: number }> = {};
    cy.nodes().forEach(n => { positions[n.id()] = { ...n.position() }; });
    this.layouts.save(this.sessionId, { positions, zoom: cy.zoom(), pan: { ...cy.pan() } });
  }

  /**
   * Put nodes where the curator left them. A node added since (after an edit) goes beside a neighbour that has a
   * place; one with none is left to the layout. Returns false when nothing was saved, so the caller lays out.
   */
  private restore(net: Network): boolean {
    const saved = this.layouts.get(this.sessionId);
    const cy = this.cy;
    if (!saved || !cy || !cy.nodes().toArray().some(n => !!saved.positions[n.id()])) return false;
    const fresh: string[] = [];
    cy.nodes().forEach(n => {
      const at = saved.positions[n.id()];
      if (at) n.position(at); else fresh.push(n.id());
    });
    fresh.forEach((id, i) => {
      const anchor = [...neighbours(net, id)].find(x => x !== id && saved.positions[x]);
      const at = anchor ? saved.positions[anchor] : null;
      const spot = at ? { x: at.x + 60 + 15 * i, y: at.y + 60 } : { x: 0, y: 0 };
      cy.getElementById(id).position(spot);
    });
    cy.zoom(saved.zoom);
    cy.pan(saved.pan);
    return true;
  }

  /** Force-directed layout; reaction nodes pull their participants close, so each reaction reads as a cluster. */
  layout(): void {
    this.cy?.layout({ name: 'cose', animate: false, nodeRepulsion: () => 12000, idealEdgeLength: () => 70, padding: 20 } as any).run();
    this.remember();
  }

  fit(): void {
    this.cy?.fit(undefined, 20);
  }

  private focus(net: Network, id: string | null, entityLabel: string | null): void {
    const cy = this.cy;
    if (!cy) return;
    cy.elements().removeClass('faded');
    this.focusLabel = entityLabel;
    if (!id) return;
    const keep = neighbours(net, id);
    // an entity also shows the entities beside it in the reactions it joins
    if (id.startsWith('e:')) [...keep].forEach(r => neighbours(net, r).forEach(x => keep.add(x)));
    cy.nodes().filter(n => !keep.has(n.id())).addClass('faded');
    cy.edges().filter(e => !keep.has(e.source().id()) || !keep.has(e.target().id())).addClass('faded');
  }

  private markSelected(): void {
    const cy = this.cy;
    if (!cy) return;
    cy.nodes().removeClass('picked');
    if (this.selectedKey) cy.getElementById('r:' + this.selectedKey).addClass('picked');
  }
}
