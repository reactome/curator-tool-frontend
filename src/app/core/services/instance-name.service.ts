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
    if (clsName === 'NonsenseMutation')
      return this.generateNonsenseMutationName(instance);
    if (clsName === 'ReplacedResidue')
      return this.generateReplacedResidueName(instance);
    if (clsName === 'ModifiedNucleotide')
      return this.generateModifiedNucleotideName(instance);
    if (instance.attributes?.has('name')) {
      let names: string[] = instance.attributes.get('name');
      if (names.length > 0)
        return names[0]; // Get the first name
    }
    // Should not get here
    return "To be named!";
  }

  private generateModifiedNucleotideName(instance: Instance): string {
    let coordinate: number | null = instance.attributes?.get('coordinate');
    let pos: string = (coordinate === undefined ? "unknown position" : coordinate!.toString());
    let modification: Instance | undefined = instance.attributes?.get('modification');
    let modificationName = modification?.displayName;
    if (modificationName) {
      let index: number = modificationName.indexOf("[ChEBI:");
      if (index > 0)
        modificationName = modificationName.substring(0, index).trim();
    }
    if (modificationName === undefined)
      modificationName = "unknown"

    return `${modificationName} at ${pos}`;
  }

  private generateReplacedResidueName(instance: Instance): string {
    let psiMods = instance.attributes?.get('psiMod');
    let coordinate: number | null = instance.attributes?.get('coordinate');
    let pos: string = (coordinate === null ? "at unknown position" : coordinate.toString());
    let replaced: string | null = null;
    let replacement: string | null = null;

    if (psiMods === null || psiMods.length === 0) {
      replaced = "unknown ";
      replacement = "unknown";
    }
    else if (psiMods.length === 1) {
      let psi: Instance = psiMods[0];
      let name: string = this.getPsiModName(psi);
      let index: number = name.indexOf("removal");
      if (index > 0)
        name = name.substring(0, index).trim();
      replaced = name;
      replacement = "unknown";
    }
    else if (psiMods.length === 2) {
      let psi: Instance = psiMods[0];
      let name: string = this.getPsiModName(psi);
      let index: number = name.indexOf("removal");
      if (index > 0)
        name = name.substring(0, index).trim();
      replaced = name;
      psi = psiMods[1];
      name = this.getPsiModName(psi);
      index = name.indexOf("residue");
      if (index > 0)
        name = name.substring(0, index).trim();
      replacement = name;
    }

    return `${replaced} ${pos} replaced with ${replacement}`;
  }

  private generateNonsenseMutationName(instance: Instance): string {
    // This is a multi-valued slot
    let psiMods = instance.attributes?.get('psiMod');
    let coordinate = instance.attributes?.get('coordinate');
    let pos = (coordinate === undefined ? "unknown position" : coordinate);
    let aa = null;
    if (psiMods == null || psiMods.length == 0) {
      aa = "unknown";
    }
    else if (psiMods.length == 1) {
      let psi = psiMods[0];
      let name = this.getPsiModName(psi);
      let index = name.indexOf("removal");
      if (index > 0)
        name = name.substring(0, index).trim();
      aa = name;
    }
    return "Nonsense mutation at " + aa + " " + pos;
  }

  private generateModifiedResidueName(instance: Instance): string {
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
