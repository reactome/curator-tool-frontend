/**
 * Models for the reaction imbalance check: a port of the desktop CuratorTool's ImbalanceCheck, which
 * compares the proteins (ReferenceGeneProducts, multiplied by stoichiometry) on each side of a Reaction.
 *
 * The check comes back as one entry of the generic QA report (`POST qaReport`), not from an endpoint of
 * its own. For a Pathway that entry is a flat table with one row per imbalanced protein of each
 * imbalanced reaction; ReactionImbalanceTable regroups those rows into the shapes below.
 */

/** The `checkName` of the reaction imbalance entry in a QA report. */
export const REACTION_IMBALANCE_CHECK = 'Reaction Imbalance Check';

/**
 * Column names of the Pathway form of the check. The Reaction form has only Reference, Identifier,
 * Input and Output, and is shown by the generic QA report table.
 */
export const REACTION_IMBALANCE_COLUMNS = {
  reactionDbId: 'Reaction_DBID',
  reaction: 'Reaction',
  reference: 'Reference',
  identifier: 'Identifier',
  input: 'Input',
  output: 'Output',
  cleavage: 'Possible_Cleavage',
  lastAuthor: 'Last_Author',
};

/** One protein whose input and output counts differ. Either count may be 0. */
export interface ReferenceImbalance {
  identifier: string;     // UniProt accession, e.g. "Q15465"
  displayName: string;    // e.g. "UniProt:Q15465 SHH"
  inputCount: number;
  outputCount: number;
}

/** An imbalanced reaction. `cleavage` marks a mismatch that looks like a protein being cut. */
export interface ReactionImbalance {
  dbId: number;
  displayName: string;
  cleavage: boolean;
  lastAuthor: string;     // "" when the reaction has no InstanceEdits
  imbalances: ReferenceImbalance[];
}
