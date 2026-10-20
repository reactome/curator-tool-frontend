/**
 * Models for the reaction imbalance check returned by `GET qa/reactionImbalance/{dbId}`: a port of
 * the desktop CuratorTool's ImbalanceCheck, which compares the proteins (ReferenceGeneProducts,
 * multiplied by stoichiometry) on each side of a Reaction.
 */

/** One protein whose input and output counts differ. Either count may be 0. */
export interface ReferenceImbalance {
  refDbId: number;
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
  lastAuthor?: string;    // Dropped from the JSON when the reaction has no InstanceEdits
  imbalances: ReferenceImbalance[];
}

/** Only imbalanced reactions are listed, so an empty `reactions` means every reaction passed. */
export interface ReactionImbalanceReport {
  eventDbId: number;
  eventDisplayName: string;
  checkedReactions: number;
  reactions: ReactionImbalance[];
}
