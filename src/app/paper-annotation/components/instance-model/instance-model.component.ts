import { Component, Input, OnChanges } from '@angular/core';

/** One exported instance, as Load into staged instances imports it. */
export interface StagedInstance {
  dbId: number;
  displayName: string;
  schemaClassName: string;
  attributes?: Record<string, unknown>;
}

/** A reference to another instance inside an attribute. */
export interface InstanceRef {
  dbId: number;
  displayName: string;
  schemaClassName?: string;
}

interface Row {
  name: string;
  values: (InstanceRef | string)[];
}

const isRef = (v: unknown): v is InstanceRef =>
  !!v && typeof v === 'object' && typeof (v as InstanceRef).dbId === 'number';

/**
 * An instance as Reactome's data model holds it: its class, displayName and attributes, exactly as the export gives
 * them. A reference to a new instance (negative dbId) opens inline, so the curator can follow a reaction to its
 * catalyst activity, entities and modified residues; an existing Reactome instance (positive dbId) links to the schema
 * view. A reference already open above (Reaction -> Regulation -> regulatedEntity -> the same Reaction) is not repeated.
 */
@Component({
  selector: 'app-instance-model',
  templateUrl: './instance-model.component.html',
  styleUrls: ['./instance-model.component.scss']
})
export class InstanceModelComponent implements OnChanges {
  @Input({ required: true }) dbId!: number | null;
  /** Every exported new instance, by dbId. */
  @Input({ required: true }) instances: Record<number, StagedInstance> = {};
  /** The dbIds open above this one. */
  @Input() path: number[] = [];

  open = new Set<number>();

  get instance(): StagedInstance | undefined {
    return this.dbId === null ? undefined : this.instances[this.dbId];
  }

  /**
   * The attributes, computed when the inputs change (not on every check): a getter made new row objects each time,
   * so Angular rebuilt the whole table, nested instances included, on every mouse move and closed what was open.
   */
  rows: Row[] = [];

  ngOnChanges(): void {
    const attrs = this.instance?.attributes ?? {};
    this.rows = Object.entries(attrs)
      .filter(([k, v]) => k !== 'dbId' && k !== 'displayName' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))
      .map(([name, v]) => ({ name, values: (Array.isArray(v) ? v : [v]).map(x => isRef(x) ? x : String(x)) }));
  }

  trackRow(_: number, r: Row): string {
    return r.name;
  }

  trackValue(i: number, v: InstanceRef | string): string | number {
    return typeof v === 'string' ? `${i}:${v}` : v.dbId;
  }

  isRef(v: InstanceRef | string): v is InstanceRef {
    return typeof v !== 'string';
  }

  /** A new instance of this export (it can open inline). */
  isNew(v: InstanceRef): boolean {
    return v.dbId < 0 && !!this.instances[v.dbId];
  }

  isAbove(v: InstanceRef): boolean {
    return v.dbId === this.dbId || this.path.includes(v.dbId);
  }

  toggle(v: InstanceRef): void {
    if (this.open.has(v.dbId)) this.open.delete(v.dbId); else this.open.add(v.dbId);
  }

  get below(): number[] {
    return this.dbId === null ? this.path : [...this.path, this.dbId];
  }
}
