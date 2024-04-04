import { Injectable } from '@angular/core';
import { Instance } from '../models/reactome-instance.model';

@Injectable({
  providedIn: 'root'
})
export class InstanceNameService {

  constructor() { }

  updateDisplayName(instance: Instance) {
    let displayName = this.generateDisplayName(instance);
    instance.displayName = displayName;
    if (instance.attributes === undefined)
      instance.attributes = new Map();
    instance.attributes.set('displayName', instance.displayName);
  }

  generateDisplayName(instance: Instance) {
    let clsName = instance.schemaClassName;
    if (clsName === 'ModifiedResidue')
      return this.generateModifiedResidueName(instance);
    if (instance.attributes?.has('name')) {
      let names: string[] = instance.attributes.get('name');
      if (names.length > 0)
        return names[0]; // Get the first name
    }
    // Should not get here
    return "To be named!";
  }

  private generateModifiedResidueName(instance: Instance) : string {
    let buffer: string[] = [];
    // Check PsiMod first. If there is a PsiMod, use it
    let psiMod = instance.attributes?.get('psiMod');
    if (psiMod !== undefined) {
        let displayName = this.getPsiModName(psiMod);
        buffer.push(displayName);
    }
    buffer.push(" at ");
    let coordinates = instance.attributes?.get('coordinate');
    if (coordinates == null) {
        buffer.push("unknown position");
    }
    else
        buffer.push(coordinates.toString());
    return buffer.join('');
  }

  private getPsiModName(psiMod: Instance): string {
    let displayName = psiMod.displayName;
    if (displayName === undefined || displayName.length === 0) 
      return ""
    // Remove MOD id in the display name
    let index = displayName.indexOf("[MOD:");
    if (index > 0)
        displayName = displayName.substring(0, index).trim();
    return displayName;
  }

}
