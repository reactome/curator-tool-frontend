import { Participant } from './llm-api.models';

/** A participant's compartment chip: where it is and how we know (the paper's passage), or that the paper does not say. */
export interface CompartmentChip {
  label: string;
  tip: string;
  /** stated | shown | parts | curator | none: the chip's style. */
  cls: string;
}

export function compartmentChip(p: Participant): CompartmentChip {
  const name = p.compartment_name;
  const quote = p.compartment_quote ? `: “${p.compartment_quote}”` : '';
  switch (name ? p.compartment_source : 'none') {
    case 'stated': return { label: name!, tip: `Stated in the paper${quote}`, cls: 'stated' };
    case 'shown': return { label: name!, tip: `Shown by the paper's experiment${quote}`, cls: 'shown' };
    case 'parts': return { label: name!, tip: 'All its components are placed there by the paper', cls: 'parts' };
    case 'curator': return { label: name!, tip: 'Set by a curator (not from the paper)', cls: 'curator' };
    case 'none': {
      const s = p.compartment_suggested?.display_name;
      return { label: 'no compartment', cls: 'none',
               tip: 'The paper does not say where it is' + (s ? `; suggested from general knowledge: ${s} (see its suggested fix)` : '') };
    }
    default: return { label: name!, tip: 'Compartment from the draft (no quote recorded)', cls: 'stated' };
  }
}

/** "protein", "gene", "RNA", "small molecule", "complex", "set". */
export function kindLabel(p: Participant): string {
  if (p.kind === 'ewas') return p.molecule === 'dna' ? 'gene' : p.molecule === 'rna' ? 'RNA' : 'protein';
  return p.kind === 'simple' ? 'small molecule' : p.kind;
}

/** "UB (S65 O-phospho-L-serine)". */
export function describeParticipant(p: Participant): string {
  const mods = (p.modifications ?? []).map(m => `${m.residue ?? ''}${m.coordinate ?? ''} ${m.mod_label ?? m.psi_mod ?? ''}`.trim());
  return mods.length ? `${p.name} (${mods.join(', ')})` : p.name;
}
