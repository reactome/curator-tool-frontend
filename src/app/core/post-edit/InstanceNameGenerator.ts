import { Instance } from '../models/reactome-instance.model';
import { SchemaClass } from '../models/reactome-schema.model';
import { DataService } from '../services/data.service';
import { InstanceUtilities } from '../services/instance.service';
import { PostEditOperation } from './PostEditOperation';

export class InstanceNameGenerator implements PostEditOperation {
  // For unknown display name
  private unknown: string = 'unknown';
  
  //TODO: May need to make sure this is a singleton!!!
  constructor(private dataService: DataService,
    private instanceUtilities: InstanceUtilities
  ) { 
  }

  postEdit(instance: Instance, 
           editedAttributeName: string | undefined): boolean {
    this.updateDisplayName(instance);
    return true;
  }

  updateDisplayName(instance: Instance) {
    let displayName = this.generateDisplayName(instance);
    instance.displayName = displayName;
    if (instance.attributes === undefined)
      instance.attributes = new Map();
    instance.attributes.set('displayName', instance.displayName);
  }

  // For if vlaue check, use if(value), not if (value === undefined || value == null) since the value may be null or undefined
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
    if (clsName === 'GroupModifiedResidue')
      return this.generateGroupModifiedResidueName(instance);
    if (clsName === 'FragmentDeletionModification')
      return this.generateFragmentModificationName(instance, "Deletion");
    if (clsName === 'FragmentInsertionModification')
      return this.generateFragmentModificationName(instance, "Insertion");
    if (clsName === 'FragmentReplacedModification')
      return this.generateFragmentModificationName(instance, "Replacement");
    if (this.isSchemaClass(instance, 'CrosslinkedResidue'))
      return this.generateCrosslinkedResidueName(instance);
    if (clsName === "DatabaseIdentifier")
      return this.generateDatabaseIdentifierName(instance);
    if (clsName === "ReferenceGroup")
      return this.generateReferenceGroupName(instance);
    if (clsName === "ReferenceMolecule" || clsName === 'ReferenceTherapeutic')
      return this.generateReferenceMoleculeName(instance);
    if (this.isSchemaClass(instance, "ReferenceSequence")) {
      return this.generateReferenceSequenceName(instance);
    }
    if (clsName === "CatalystActivity")
      return this.generateCatalystActivityName(instance);
    if (clsName === "LiteratureReference")
      return this.generateLiteratureReferenceName(instance);
    // The following is for Regulation
    if (this.isSchemaClass(instance, 'Regulation'))
      return this.generateRegulationName(instance);
    if (clsName === "Figure")
      return this.generateFigureName(instance);
    if (clsName === "Summation")
      return this.generateSummationName(instance);
    if (clsName === "Person")
      return this.generatePersonName(instance);
    if (clsName === "InstanceEdit")
      return this.generateInstanceEditName(instance);
    if (this.isSchemaClass(instance, "PhysicalEntity"))
      return this.generateEntityName(instance);
    if (this.isSchemaClass(instance, 'ReactionLikeEvent'))
      return this.generateReactionName(instance);
    if (this.isSchemaClass(instance, 'PathwayDiagram'))
      return this.generatePathwayDiagramName(instance);
    if (this.isSchemaClass(instance, 'TargettedInteraction'))
      return this.generateTargettedInteractionName(instance);
    if (this.isSchemaClass(instance, 'FunctionalStatus')) {
      return this.generateFunctionalStatusName(instance);
    }
    if (this.isSchemaClass(instance, 'StableIdentifier')) {
      return this.generateStableIdentifierName(instance);
    }
    if (this.isSchemaClass(instance, 'EntityFunctionalStatus')) {
      return this.generateEntityFunctionalStatusName(instance);
    }
    if (this.isSchemaClass(instance, 'ControlReference')) {
      return this.generateControlReferenceName(instance);
    }
    if (this.isSchemaClass(instance, '_UpdateTracker')) {
      return this.generateUpdateTrackerName(instance);
    }
    if (this.isSchemaClass(instance, '_Release')) {
      return this.generateReleaseName(instance);
    }
    if (this.isSchemaClass(instance, 'NegativePrecedingEvent'))
      return this.generateNegativePrecedingEventName(instance);
    if (this.isSchemaClass(instance, '_Deleted'))
      return this.generateDeletedName(instance);
    if (this.isSchemaClass(instance, '_DeletedInstance'))
      return this.generateDeletedInstanceName(instance);
    if (instance.attributes?.has('name')) {
      let names: string[] = instance.attributes.get('name');
      if (names && names.length > 0)
        return names[0]; // Get the first name
    }
    // Should not get here
    return this.unknown;
  }

  private generateCrosslinkedResidueName(instance: Instance): string {
    const builder: string[] = [];
    if (this.isSchemaClass(instance, "InterChainCrosslinkedResidue")) {
      builder.push("Inter-chain Crosslink via ");
    } else {
      builder.push("Intra-chain Crosslink via ");
    }
    const psiMod: Instance | undefined = instance.attributes?.get("psiMod");
    if (psiMod !== undefined) {
      const displayName: string = this.getPsiModName(psiMod);
      builder.push(displayName);
    } else {
      builder.push("unknown");
    }
    builder.push(" at ");
    const coordinate: number | undefined = instance.attributes?.get("coordinate");
    builder.push(coordinate ? coordinate.toString() : "unknown");
    builder.push(" and ");
    const secondCoordinate: number | undefined = instance.attributes?.get("secondCoordinate");
    builder.push(secondCoordinate ? secondCoordinate.toString() : "unknown");
    return builder.join("");
  }

  private generateFragmentModificationName(instance: Instance, type: string): string {
    let start: number | undefined = instance.attributes?.get('startPositionInReferenceSequence');
    let startText: string = start ? start.toString() : "unknown";

    let end: number | undefined = instance.attributes?.get('endPositionInReferenceSequence');
    let endText: string = end ? end.toString() : "unknown";

    let builder: string[] = [];
    builder.push(type + " of residues ");
    builder.push(startText + " to ");
    builder.push(endText);

    if (this.isValidAttribute(instance, 'coordinate')) {
      let coordinate: number | undefined = instance.attributes?.get('coordinate');
      builder.push(" at ");
      builder.push(coordinate ? coordinate.toString() : "unknown");
      builder.push(" from ");

      // Need to use ReferenceSequence
      let refSeq = instance.attributes?.get('referenceSequence');
      builder.push(refSeq ? refSeq.displayName : "unknown");
    }

    if (this.isValidAttribute(instance, 'alteredAminoAcidFragment')) {
      let aas: string | undefined = instance.attributes?.get('alteredAminoAcidFragment');
      if (aas && aas.trim().length > 0) {
        builder.push(" by " + aas);
      }
    }

    return builder.join('');
  }

  private isValidAttribute(instance: Instance, attributeName: string): boolean {
    for (let attribute of instance.schemaClass?.attributes!) {
      if (attribute.name === attributeName)
        return true; // Just do a simple linear search
    }
    return false;
  }

  private isSchemaClass(instance: Instance, className: string): boolean {
    return this.instanceUtilities.isSchemaClass(instance, className, this.dataService);
  }

  private generateGroupModifiedResidueName(instance: Instance): string {
    let coordinate: number = instance.attributes?.get('coordinate');
    let pos: string = (coordinate === undefined ? "unknown position" : coordinate.toString());
    let psiMod: Instance = instance.attributes?.get('psiMod');
    let psiModName: string = psiMod === undefined ? "unknown" : this.getPsiModName(psiMod);
    let modification: Instance = instance.attributes?.get('modification');
    let modificationName = modification === undefined ? "unknown" : modification.displayName;
    return `${psiModName} (${modificationName}) at ${pos}`;
  }

  private generateModifiedNucleotideName(instance: Instance): string {
    let coordinate: number | null = instance.attributes?.get('coordinate');
    let pos: string = (coordinate ? coordinate!.toString() : "unknown position");
    let modification: Instance | undefined = instance.attributes?.get('modification');
    let modificationName = modification?.displayName;
    if (modificationName) {
      let index: number = modificationName.indexOf("[ChEBI:");
      if (index > 0)
        modificationName = modificationName.substring(0, index).trim();
    }
    if (!modificationName)
      modificationName = "unknown"

    return `${modificationName} at ${pos}`;
  }

  private generateReplacedResidueName(instance: Instance): string {
    let psiMods = instance.attributes?.get('psiMod');
    let coordinate = instance.attributes?.get('coordinate');
    let pos: string = (coordinate ? coordinate.toString() : "at unknown position");
    let replaced: string = 'unknown ';
    let replacement: string = 'unknown';

    if (psiMods) {
      if (psiMods.length === 1) {
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
    if (psiMod) {
      let displayName = this.getPsiModName(psiMod);
      buffer.push(displayName);
    }
    buffer.push(" at ");
    let coordinates = instance.attributes?.get('coordinate');
    coordinates ? buffer.push(coordinates.toString()) : buffer.push("unknown position");
    return buffer.join('');
  }

  private getPsiModName(psiMod: Instance): string {
    let displayName = psiMod.displayName;
    if (!displayName)
      return ""
    // Remove MOD id in the display name
    let index = displayName.indexOf("[MOD:");
    if (index > 0)
      displayName = displayName.substring(0, index).trim();
    return displayName;
  }

  private generateUpdateTrackerName(instance: Instance) {
    let updatedEvent = instance.attributes?.get('updatedEvent');
    let updatedEventDBID = updatedEvent.getDBID();
    return "Revision of instance: " + updatedEventDBID;
  }

  private generateReleaseName(instance: Instance) {
    let releaseNumber = instance.attributes?.get('releaseNumber');
    let releaseDate = instance.attributes?.get('releaseDate');
    return releaseNumber + " on " + releaseDate;
  }

  // TODO: Need to test this code
  private generateDeletedName(instance: Instance) {
    let deletedIds = instance.attributes?.get('deletedInstanceDB_ID');
    let displayName = undefined;
    if (!deletedIds || deletedIds.length === 0)
      displayName = "Deletion of instance: unknown";
    else if (deletedIds.length >= 1)
      displayName = "Deletion of instance: " + deletedIds.join(", ");
    return displayName;
  }

  // TODO: Need to test this code
  private generateDeletedInstanceName(instance: Instance) {
    let displayName = [];
    displayName.push("Deleted Instance - [");
    let clsName = instance.attributes?.get('class');
    displayName.push(clsName + ": ");
    let name = instance.attributes?.get('name');
    displayName.push(name + " (");
    let dbId = instance.attributes?.get('deletedInstanceDB_ID');
    displayName.push(dbId + ")");
    // Sometimes we may don't have species
    let species = instance.attributes?.get('species');
    if (species === undefined)
      displayName.push("]");
    else {
      displayName.push(" - ");
      displayName.push(species.displayName + "]");
    }
    return displayName.join("");
  }

  private generateControlReferenceName(instance: Instance) {
    let builder = [];
    if (this.isSchemaClass(instance, 'RegulationReference')) {
      //TODO: There is a bug in the data model: regulation is defined by 'regulatedBy' in the class!
      // let regulation = instance.attributes?.get('regulation');
      let regulation = instance.attributes?.get('regulatedBy');
      builder.push(regulation.displayName);
    }
    else if (this.isSchemaClass(instance, 'CatalystActivityReference')) {
      let ca = instance.attributes?.get('catalystActivity');
      builder.push(ca.displayName);
    }
    else if (this.isSchemaClass(instance, 'MarkerReference')) {
      let markers = instance.attributes?.get('marker');
      if (markers === undefined || markers.length == 0)
        builder.push("Marker unknown");
      else if (markers.length === 1) {
        let markerName = markers[0].displayName;
        builder.push(markerName);
      }
      else {
        let markerName = markers[0].displayName;
        builder.push(markerName + "...");
      }
    }
    let reference = instance.attributes?.get('literatureReference');
    if (reference) {
      builder.push(": " + reference[0].displayName);
    }
    return builder.join("");
  }

  private generateStableIdentifierName(instance: Instance): string {
    let identifier = instance.attributes?.get('identifier');
    let version = instance.attributes?.get('identifierVersion');
    return identifier + "." + version;
  }

  private generateTargettedInteractionName(instance: Instance): string {
    let factor = instance.attributes?.get('factor');
    let target = instance.attributes?.get('target');
    return factor.displayName + " " + target.displayName;
  }

  private generateFunctionalStatusName(instance: Instance): string {
    let builder = [];
    let type = instance.attributes?.get('functionalStatusType');
    type ? builder.push(type.displayName ?? 'unknown') : builder.push('uknown');
    builder.push(" via ");
    let variant = instance.attributes?.get('structuralVariant');
    variant ? builder.push(variant.displayName) : builder.push('unknown');
    return builder.join('');
  }

  private generateEntityFunctionalStatusName(instance: Instance): string {
    let builder = [];
    let values = instance.attributes?.get('functionalStatus');
    if (!values || values.length === 0)
      builder.push("unknown");
    else {
      let types = new Set<string>();
      for (let inst of values) {
        let name = inst.displayName;
        let index = name.indexOf(" ");
        name = name.substring(0, index);
        types.add(name);
      }
      let typeList = Array.from(types);
      typeList.sort();
      for (let i = 0; i < typeList.length; i++) {
        builder.push(typeList[i]);
        if (i < typeList.length - 1)
          builder.push(" and ");
      }
    }
    builder.push(" of ");
    let pe = instance.attributes?.get('diseaseEntity');
    pe ? builder.push(pe.displayName) : builder.push("unknown");
    return builder.join('');
  }

  private generatePathwayDiagramName(instance: Instance): string {
    let pathways = instance.attributes?.get('representedPathway');
    if (pathways && pathways.length > 0) {
      let builder = [];
      builder.push("Diagram of ");
      for (let i = 0; i < pathways.length; i++) {
        let pathway = pathways[i];
        builder.push(pathway.displayName);
        if (i < pathways.length - 2)
          builder.push(", ");
        else if (i === pathways.length - 2) {
          if (pathways.length > 2)
            builder.push(", ");
          builder.push(" and ");
        }
      }
      return builder.join('');
    }
    return this.unknown;
  }

  private generateInstanceEditName(instance: Instance): string {
    let buffer: string[] = [];
    let values = instance.attributes?.get("author");
    if (values !== undefined && values.length > 0) {
      let author: Instance | undefined;
      for (let it = 0; it < values.length; it++) {
        author = values[it] as Instance;
        buffer.push(author.displayName ?? 'unknown');
        if (it < values.length - 1)
          buffer.push(", ");
      }
    }
    values = instance.attributes?.get("dateTime");
    if (values !== undefined && values.length > 0) {
      buffer.push(", ");
      let dateTime = values[0].toString();
      let pattern = /^(\\d){4}-(\\d){2}-(\\d){2}/;
      let matcher = dateTime.match(pattern);
      if (matcher !== null) {
        buffer.push(matcher[0]);
      }
      else {
        buffer.push(dateTime.substring(0, 4));
        buffer.push("-");
        buffer.push(dateTime.substring(4, 6));
        buffer.push("-");
        buffer.push(dateTime.substring(6, 8));
      }
    }
    return buffer.join("");
  }

  private generatePersonName(instance: Instance): string {
    let buffer: string[] = [];
    let value = instance.attributes?.get("surname");
    (value && value.length > 0) ? buffer.push(value) : buffer.push('unknown');
    value = instance.attributes?.get("firstname");
    if (value && value.length > 0) {
      buffer.push(", ");
      buffer.push(value);
    }
    else {
      value = instance.attributes?.get("initial");
      if (value && value.length > 0) {
        buffer.push(", ");
        buffer.push(value);
      }
    }
    return buffer.join("");
  }

  private generateSummationName(instance: Instance): string {
    // This is a single-valued slot
    let text = instance.attributes?.get("text").trim();
    if (text && text.length > 0) {
      if (text.length > 60)
        return text.substring(0, 60) + "...";
      else
        return text;
    }
    return this.unknown;
  }

  private generateFigureName(instance: Instance): string {
    let values = instance.attributes?.get("url");
    if (values && values.length > 0)
      return values;
    return this.unknown;
  }

  private generateRegulationName(regulation: Instance): string {
    let builder: string[] = [];
    if (this.isSchemaClass(regulation, 'NegativeGeneExpressionRegulation'))
      builder.push("Negative gene expression regulation");
    else if (this.isSchemaClass(regulation, 'NegativeRegulation'))
      builder.push("Negative regulation");
    else if (this.isSchemaClass(regulation, 'PositiveGeneExpressionRegulation'))
      builder.push("Positive gene expression regulation");
    else if (this.isSchemaClass(regulation, 'Requirement'))
      builder.push("Requirement");
    else if (this.isSchemaClass(regulation, 'PositiveRegulation'))
      builder.push("Positive regulation");
    else
      builder.push("Regulation");
    builder.push(" by ");
    let regulator = regulation.attributes?.get('regulator');
    if (regulator) {
      builder.push("'" + regulator.displayName ?? '' + "'");
    }
    else
      builder.push("'unknown'")
    return builder.join("");
  }

  private generateLiteratureReferenceName(instance: Instance): string {
    const title: string | undefined = instance.attributes?.get("title");
    if (title && title.trim().length > 0) {
      return title;
    }
    // Try pubmed
    const pubMedValues: string | undefined = instance.attributes?.get("pubMedIdentifier");
    if (pubMedValues) {
      return pubMedValues;
    }
    // Try journal
    const journal: string | undefined = instance.attributes?.get("journal");
    if (journal && journal.trim().length > 0) {
      return journal;
    }
    return this.unknown;
  }

  private generateCatalystActivityName(instance: Instance): string {
    const buffer: string[] = [];
    const activity: Instance | undefined = instance.attributes?.get("activity");
    let actName: string;
    if (activity === undefined) {
      actName = "unknown";
    } else {
      actName = activity.displayName ?? 'unknown';
    }
    buffer.push(actName);
    if (actName.toLowerCase().indexOf("activity") === -1) { // need activity
      buffer.push(" activity ");
    } else {
      buffer.push(" ");
    }
    buffer.push("of");
    const entity: Instance | undefined = instance.attributes?.get("physicalEntity");
    buffer.push(entity === undefined ? " unknown entity" : " " + entity.displayName);
    return buffer.join("");
  }

  private generateDatabaseIdentifierName(instance: Instance): string {
    const buffer: string[] = [];
    // Single valued attribute
    const refDBValue: Instance | undefined = instance.attributes?.get("referenceDatabase");
    if (refDBValue !== undefined) {
      buffer.push(refDBValue.displayName ?? 'unknown');
    }
    const identifierValue: string | undefined = instance.attributes?.get("identifier");
    if (identifierValue !== undefined) {
      buffer.push(":");
      // This should be a single value
      buffer.push(identifierValue);
    }
    return buffer.join("");
  }

  private generateReferenceSequenceName(instance: Instance): string {
    let dbName: string | undefined = undefined;
    const refDB: Instance | undefined = instance.attributes?.get("referenceDatabase");
    if (refDB !== undefined) {
      dbName = refDB.displayName;
    }
    if (dbName === undefined) {
      dbName = "Unknown";
    }
    let identifier: string | undefined = undefined;
    if (instance.attributes?.has("variantIdentifier")) {
      // Use variantIdentifier first
      identifier = instance.attributes?.get("variantIdentifier");
    } else if (instance.attributes?.has("identifier")) {
      identifier = instance.attributes?.get("identifier");
    }
    if (identifier === undefined) {
      identifier = "Unknown";
    }
    let name: string | undefined = undefined;
    if (instance.attributes?.has("geneName")) {
      name = instance.attributes?.get("geneName")[0] ?? 'unknown';
    } else if (instance.attributes?.has("name")) {
      name = instance.attributes?.get("name")[0] ?? 'unknown';
    }
    if (name === null) {
      name = "unknown";
    }
    return dbName + ":" + identifier + " " + name;
  }


  private generateReferenceGroupName(instance: Instance): string {
    const names: string[] | undefined = instance.attributes?.get("name");
    if (names !== undefined && names.length > 0) {
      const name: string = names[0];
      return name;
    }
    const buffer: string[] = [];
    const refDB: Instance | undefined = instance.attributes?.get("referenceDatabase");
    if (refDB !== undefined) {
      buffer.push(refDB.displayName ?? 'unknown');
    }
    const identifier: string | undefined = instance.attributes?.get("identifier");
    if (identifier !== undefined) {
      if (refDB !== undefined) {
        buffer.push(":");
      } else {
        buffer.push("unknown:");
      }
      buffer.push(identifier);
    }
    return buffer.join("");
  }

  private generateReferenceMoleculeName(instance: Instance): string {
    const buffer: string[] = [];
    const names: string[] | undefined = instance.attributes?.get("name");
    if (names !== undefined && names.length > 0) {
      const name: string = names[0];
      buffer.push(name);
    }
    const refDB: Instance | undefined = instance.attributes?.get("referenceDatabase");
    if (refDB !== undefined) {
      buffer.push(" [");
      buffer.push(refDB.displayName ?? 'unknown');
    } else {
      buffer.push(" [unknown");
    }
    buffer.push(":");
    const identifier: string | undefined = instance.attributes?.get("identifier");
    if (identifier !== undefined) {
      buffer.push(identifier);
    } else {
      buffer.push("unknown");
    }
    buffer.push("]");
    return buffer.join("");
  }

  private generateNegativePrecedingEventName(instance: Instance): string {
    // This is a multi-valued slot
    const precedingEvent: Instance[] | undefined = instance.attributes?.get("precedingEvent");
    // Single-valued slot
    const reason: Instance | undefined = instance.attributes?.get("reason");
    const builder: string[] = [];
    if (reason)
      builder.push(reason.displayName ?? 'unknown');
    if (precedingEvent) {
      if (builder.length > 0)
        builder.push(": ");
      builder.push(precedingEvent[0].displayName ?? 'unknown');
    }
    if (builder.length === 0) // Show something
      builder.push(instance.schemaClassName + ": " + instance.dbId);
    return builder.join("");
  }

  private generateReactionName(reaction: Instance): string {
    const name: string[] | undefined = reaction.attributes?.get("name");
    if (name && name.length > 0 && name[0].trim().length > 0) {
      return name[0]; // Use the first name as default
    }
    // However, if there is no name defined, use input/output
    const input: Instance[] | undefined = reaction.attributes?.get("input");
    const output: Instance[] | undefined = reaction.attributes?.get("output");
    const buffer: string[] = [];
    (input && input.length > 0) ? buffer.push(input[0].displayName ?? '') : buffer.push('');
    buffer.push("->");
    (output && output.length > 0) ? buffer.push(output[0].displayName ?? '') : buffer.push('');
    return buffer.join("");
  }

  private generateEntityName(instance: Instance): string {
    const buffer: string[] = [];
    // This is a multi-valued slot
    const values: string[] | undefined = instance.attributes?.get("name");
    if (values && values.length > 0) {
      buffer.push(values[0]);
    } else {
      buffer.push("unknown");
    }
    // Check compartment
    if (this.isValidAttribute(instance, "compartment")) {
      const compartmentValues: Instance[] | undefined = instance.attributes?.get("compartment");
      if (compartmentValues && compartmentValues.length > 0) {
        const compartment: Instance = compartmentValues[0];
        buffer.push(" [");
        buffer.push(compartment.displayName ?? 'unknown');
        buffer.push("]");
      }
    }
    return buffer.join("");
  }

}
