import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EntityInfo, Issue, Participant, Proposal } from '../../models/llm-api.models';
import { CompartmentChip, compartmentChip, describeParticipant, kindLabel } from '../../models/compartment-chip';
import { StagedInstance } from '../instance-model/instance-model.component';

/**
 * Every entity of the annotation (the reactions' participants and their parts): where it is (compartment, with the
 * paper's passage), what it is (identifiers, an existing Reactome instance it reuses), where it is used, its issues
 * and their fixes, and the instances that loading creates for it. Its issues are the same the reaction panel lists
 * under "About its entities": whatever is done in either place, the page re-reads and both show it.
 */
@Component({
  selector: 'app-entities-panel',
  templateUrl: './entities-panel.component.html',
  styleUrls: ['./entities-panel.component.scss']
})
export class EntitiesPanelComponent {
  @Input({ required: true }) sessionId!: string;
  @Input() entities: EntityInfo[] = [];
  @Input() issues: Issue[] = [];
  @Input() proposals: Proposal[] = [];
  @Input() instances: Record<number, StagedInstance> = {};
  /** The entity shown (two-way: the reaction panel can ask for one). */
  @Input() selectedKey: string | null = null;
  @Output() selectedKeyChange = new EventEmitter<string>();
  @Output() openReaction = new EventEmitter<string>();
  /** Emitted after anything here changed the session: the page re-reads it. */
  @Output() changed = new EventEmitter<void>();
  @Output() proposalDecided = new EventEmitter<Proposal>();

  filter = '';
  sort: 'draft' | 'name' | 'attention' = 'draft';
  /** "As Reactome instances": what loading creates, the main output, so it starts open (as in the reaction panel). */
  showInstances = true;

  readonly kindLabel = kindLabel;
  readonly describe = describeParticipant;

  compartment(p: Participant): CompartmentChip {
    return compartmentChip(p);
  }

  issuesOf(key: string): Issue[] {
    return this.issues.filter(i => i.participant_key === key && !i.reaction_key);
  }

  /** Open issues worth a look: not notes, unless a fix comes with it; not waiting on a keep decision. */
  openCount(key: string): number {
    return this.issuesOf(key).filter(i => i.status === 'open' && !i.blocked_by
      && (i.severity !== 'info' || (!!i.proposal_id && this.proposals.some(p => p.id === i.proposal_id && p.status === 'pending')))).length;
  }

  get shown(): EntityInfo[] {
    const q = this.filter.trim().toLowerCase();
    const list = this.entities.filter(e => !q || e.participant.name.toLowerCase().includes(q) || e.key.toLowerCase().includes(q)
      || (e.participant.uniprot ?? '').toLowerCase().includes(q) || (e.participant.compartment_name ?? '').toLowerCase().includes(q));
    if (this.sort === 'name') {
      return [...list].sort((a, b) => a.participant.name.localeCompare(b.participant.name, undefined, { sensitivity: 'base', numeric: true }));
    }
    if (this.sort === 'attention') {
      const pos = new Map(list.map((e, i) => [e.key, i]));
      return [...list].sort((a, b) => this.openCount(b.key) - this.openCount(a.key) || pos.get(a.key)! - pos.get(b.key)!);
    }
    return list;
  }

  get selected(): EntityInfo | undefined {
    return this.entities.find(e => e.key === this.selectedKey) ?? this.shown[0];
  }

  select(key: string): void {
    this.selectedKey = key;
    this.selectedKeyChange.emit(key);
  }

  nameOf(key: string): string {
    return this.entities.find(e => e.key === key)?.participant.name ?? key;
  }

  roleLabel(roles: string[]): string {
    return roles.join(', ');
  }

  onChanged(): void {
    this.changed.emit();
  }
}
