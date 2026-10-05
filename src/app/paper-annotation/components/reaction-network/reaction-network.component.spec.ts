import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { Network } from '../../models/llm-api.models';
import { LlmApiError, LlmApiService } from '../../services/llm-api.service';
import { PaperAnnotationModule } from '../../paper-annotation.module';
import { NetworkLayoutStore } from './network-layout.store';
import { ReactionNetworkComponent } from './reaction-network.component';

describe('ReactionNetworkComponent', () => {
  const NET: Network = {
    nodes: [
      { id: 'e:ub', type: 'entity', key: 'ub', kind: 'ewas', label: 'UB', unresolved: [], openIssues: 0 },
      { id: 'r:r0', type: 'reaction', key: 'r0', label: 'Ub is phosphorylated', openIssues: 0 },
    ],
    edges: [{ id: 'input:0', type: 'input', source: 'e:ub', target: 'r:r0' }],
  };
  let api: jasmine.SpyObj<LlmApiService>;
  let fixture: ComponentFixture<ReactionNetworkComponent>;
  let component: ReactionNetworkComponent;
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  const create = (result: Network | Error) => {
    api = jasmine.createSpyObj('LlmApiService', ['network']);
    api.network.and.returnValue(result instanceof Error ? throwError(() => result) : of(result));
    TestBed.configureTestingModule({
      imports: [PaperAnnotationModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: LlmApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(ReactionNetworkComponent);
    component = fixture.componentInstance;
    component.sessionId = 's1';
    fixture.detectChanges();
    component.ngOnChanges({ sessionId: { currentValue: 's1' } as any });
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  it('loads the network of the session and draws every node', () => {
    create(NET);
    expect(api.network).toHaveBeenCalledWith('s1');
    expect((component as any).cy.nodes().length).toBe(2);
    expect(text()).toContain('protein');
  });

  it('says so when there is nothing to draw', () => {
    create({ nodes: [], edges: [] });
    expect(text()).toContain('no reactions to draw');
  });

  it('shows the error when the network cannot be read', () => {
    create(new LlmApiError(500, 'boom'));
    expect(text()).toContain('boom');
  });

  it('emits the reaction key when a reaction node is tapped, and opens it on a double tap', () => {
    create(NET);
    const picked: string[] = [], opened: string[] = [];
    component.reactionSelected.subscribe(k => picked.push(k));
    component.reactionOpened.subscribe(k => opened.push(k));
    const cy = (component as any).cy;
    cy.getElementById('r:r0').emit('tap');
    cy.getElementById('r:r0').emit('dbltap');
    expect(picked).toEqual(['r0']);
    expect(opened).toEqual(['r0']);
  });

  it('fades what an entity does not touch, and clears it when the background is tapped', () => {
    create({ ...NET, nodes: [...NET.nodes, { id: 'r:r1', type: 'reaction', key: 'r1', label: 'Other', openIssues: 0 }] });
    const cy = (component as any).cy;
    cy.getElementById('e:ub').emit('tap');
    expect(cy.getElementById('r:r1').hasClass('faded')).toBeTrue();
    expect(cy.getElementById('r:r0').hasClass('faded')).toBeFalse();
    expect(component.focusLabel).toBe('UB');
    cy.emit('tap');
    expect(cy.nodes().filter((n: any) => n.hasClass('faded')).length).toBe(0);
  });

  it('puts nodes back where the curator left them, with the zoom and pan, when the graph is drawn again', () => {
    create(NET);
    const cy = (component as any).cy;
    cy.getElementById('e:ub').position({ x: 123, y: 456 });
    cy.zoom(1.7);
    cy.pan({ x: 30, y: 40 });
    fixture.destroy();                                  // leaving the tab

    fixture = TestBed.createComponent(ReactionNetworkComponent);
    component = fixture.componentInstance;
    component.sessionId = 's1';
    fixture.detectChanges();
    component.ngOnChanges({ sessionId: { currentValue: 's1' } as any });
    const again = (component as any).cy;
    expect(again.getElementById('e:ub').position()).toEqual({ x: 123, y: 456 });
    expect(again.zoom()).toBeCloseTo(1.7);
    expect(again.pan()).toEqual({ x: 30, y: 40 });
  });

  it('places a node added since beside a neighbour, and keeps the rest as they were', () => {
    create(NET);
    (component as any).cy.getElementById('e:ub').position({ x: 100, y: 100 });
    (component as any).cy.getElementById('r:r0').position({ x: 200, y: 100 });
    api.network.and.returnValue(of({
      nodes: [...NET.nodes, { id: 'e:new', type: 'entity', key: 'new', kind: 'simple', label: 'New', unresolved: [], openIssues: 0 }],
      edges: [...NET.edges, { id: 'input:9', type: 'input', source: 'e:new', target: 'r:r0' }] }));
    component.ngOnChanges({ stamp: { currentValue: 1 } as any });    // reload after an edit
    const cy = (component as any).cy;
    expect(cy.getElementById('e:ub').position()).toEqual({ x: 100, y: 100 });
    const near = cy.getElementById('e:new').position();
    expect(Math.abs(near.x - 200)).toBeLessThan(120);
    expect(Math.abs(near.y - 100)).toBeLessThan(120);
  });

  it('lays out again, and remembers that, when Re-layout is pressed', () => {
    create(NET);
    (component as any).cy.getElementById('e:ub').position({ x: 9999, y: 9999 });
    component.layout();
    expect((component as any).cy.getElementById('e:ub').position().x).not.toBe(9999);
    expect(TestBed.inject(NetworkLayoutStore).get('s1')!.positions['e:ub'].x).not.toBe(9999);
  });

  it('marks the selected reaction', () => {
    create(NET);
    component.selectedKey = 'r0';
    component.ngOnChanges({ selectedKey: { currentValue: 'r0' } as any });
    expect((component as any).cy.getElementById('r:r0').hasClass('picked')).toBeTrue();
  });
});
