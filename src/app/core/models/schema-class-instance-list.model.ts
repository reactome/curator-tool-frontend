export interface Instance {
  dbId: number;
  displayName: string;
}

export class InstanceList implements Instance {
  dbId: number;
  displayName: string;
  constructor(dbId: number, displayName: string) {
    this.dbId = dbId;
    this.displayName = displayName;
  }
}
