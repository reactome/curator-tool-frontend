/**
 * Types for the curator-tool-llm REST API (/api/llm). They mirror docs/openapi.json in that repo; the
 * field names are the server's (snake_case for pydantic models, camelCase for the few hand-built dicts).
 */
import { Instance } from 'src/app/core/models/reactome-instance.model';

export type SessionStatus = 'queued' | 'running' | 'ready' | 'failed';
export type IssueSeverity = 'info' | 'warning' | 'action';
export type IssueStatus = 'open' | 'resolved' | 'dismissed';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface StartResponse {
  sessionId: string;
  jobId: string;
}

/** `result` is what the job produced, once it is done (only some jobs have one, e.g. a gene search). */
export interface Job<T = unknown> {
  id: string;
  status: JobStatus;
  progress: string;
  error: string | null;
  result?: T | null;
}

/** A paper suggested for a gene (POST /papers/by-gene), with the rubric judge's verdict on it. */
export interface CandidatePaper {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  /** null: PubMed Central has no full text, so the paper can only be annotated from its PDF. */
  pmcid: string | null;
  /** 1-10, how useful the paper is for a Reactome annotation. */
  score: number | null;
  /** DIRECT | INDIRECT | INSUFFICIENT | NONE */
  evidence_type: string | null;
  annotatable: boolean | null;
  justification: string;
}

/** The `result` of a gene search job. `papers` are best first; fewer than asked means little usable literature. */
export interface GeneSearchResult {
  gene: string;
  accession: string | null;
  /** Papers the PubMed searches returned. */
  pool_size: number;
  /** Of those, how many the judge read. */
  candidate_pool: number;
  dropped_below_threshold: number;
  papers: CandidatePaper[];
}

/** One paper of a session. `source` is the tag its reactions and quotes carry (`PMID:24751536`, or the PDF's stored file name). */
export interface PaperInfo {
  source: string;
  kind: 'pmid' | 'pdf';
  pmid: string | null;
  /** What to show: the PMID, or the uploaded file's name. */
  name: string;
  /**
   * Annotated as a review article: reactions it only cites were kept. Null until the run decides (a PubMed ID's kind is
   * read from PubMed); absent from services older than this flag.
   */
  review?: boolean | null;
}

/** "PMID 24751536" or the PDF's file name. */
export function paperLabel(p: PaperInfo): string {
  if (p.kind === 'pmid') return `PMID ${p.pmid ?? p.name}`;
  return p.pmid ? `${p.name} (PMID ${p.pmid})` : p.name;
}

/**
 * What the service found for a PDF (POST /papers/identify, or /sessions/{id}/papers/identify for one already uploaded):
 * the PubMed ID of its article, by the DOI on its first pages or by its title. A suggestion for the curator to keep,
 * edit or clear; `note` says why nothing was found (not in PubMed, a preprint, PubMed unreachable).
 */
export interface PaperIdentity {
  found: boolean;
  pmid?: string;
  title?: string;
  method?: 'doi' | 'title';
  doi?: string | null;
  note?: string;
}

/**
 * A "session" here (and in the curator-tool-llm API: /sessions, sessionId) means one annotation: one Annotate run and
 * its saved result, not a login session. Curators only ever see the word "annotation". Sessions are stored per
 * username, so "Your annotations" lists all of a curator's sessions, across logins and browsers.
 */
export interface SessionSummary {
  id: string;
  pmid: string | null;
  source: string;
  status: SessionStatus;
  progress: string;
  created: number;
  updated: number;
  n_reactions: number;
  n_open_issues: number;
  /** How many papers the session merges (absent from an older service: one). */
  n_papers?: number;
}

export interface ReactionRef {
  key: string;
  name: string;
  dbId: number | null;
  evidenceIds: string[];
  /** "inputs -> outputs (catalyst X)", to tell apart reactions that share a name (absent from an older service). */
  equation?: string;
}

export interface SessionDetail extends SessionSummary {
  focus: string | null;
  error: string | null;
  reactions: ReactionRef[];
  papers?: PaperInfo[];
  /** Each reaction's last QA review, by reaction key (absent from an older service). */
  qa?: Record<string, ReactionQA>;
}

/** The last QA review of one reaction: where it goes in the curator's list. */
export interface ReactionQA {
  priority: QAPriority;
  summary: string | null;
  score: number | null;
  /** The reviewer's answer to "is this a molecular reaction at all" (null when not asked). */
  is_reaction: boolean | null;
}

/**
 * What an issue is about, in the order a curator should look: whether the reaction should exist at all, whether Reactome
 * already has it, its participants / catalyst / regulation, identifiers, its evidence, the paper.
 */
export type IssueCategory = 'keep' | 'existing' | 'content' | 'identifiers' | 'evidence' | 'paper' | 'other';
export const ISSUE_CATEGORY_ORDER: IssueCategory[] = ['keep', 'existing', 'content', 'identifiers', 'evidence', 'paper', 'other'];
export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
  keep: 'Keep this reaction?', existing: 'Already in Reactome?', content: 'Participants, catalyst, regulation',
  identifiers: 'Identifiers', evidence: 'Evidence and summary', paper: 'The paper', other: 'Other'
};

export interface Issue {
  id: string;
  source: 'evidence' | 'builder' | 'resolver' | 'emitter' | 'pipeline' | 'existing' | 'qa' | 'checks';
  severity: IssueSeverity;
  code: string;
  message: string;
  reaction_key: string | null;
  participant_key: string | null;
  instance_db_id: number | null;
  status: IssueStatus;
  /** The part of the reaction it is about (catalyst, inputs, summation, ...). */
  field?: string | null;
  category?: IssueCategory;
  /** The open "keep this reaction?" issue this one waits on: it is moot if the reaction is removed. */
  blocked_by?: string | null;
  /** A pending suggested fix that resolves it. */
  proposal_id?: string | null;
}

export type Verification = 'unverified' | 'exact' | 'fuzzy' | 'failed';

export interface Evidence {
  id: string;
  quote: string;
  pmid: string | null;
  /** The paper the quote is from (a `PaperInfo.source`); absent from an older service. */
  source?: string | null;
  section: string | null;
  page: number | null;
  figure: string | null;
  char_span: [number, number] | null;
  verified: Verification;
  match_score: number | null;
  supports: string[];
  system: string | null;
  experimental_species: string | null;
  claim_origin: 'this_paper' | 'cited' | 'curator_assertion';
  cited_reference: string | null;
  strength: string | null;
}

export interface InstanceEvidence {
  field: string;
  evidence: Evidence;
}

export interface ExistingRef {
  db_id: number;
  display_name: string;
  schema_class: string;
}

export interface ExistingMatch {
  reaction_key: string;
  db_id: number;
  display_name: string;
  st_id: string;
  level: 'same' | 'similar';
  score: number;
  cites_pmid: boolean;
  catalyst_match: boolean;
  overlap: number;
  similarity: number;
  reasons: string[];
}

export interface Participant {
  kind: 'ewas' | 'simple' | 'complex' | 'set';
  key: string;
  name: string;
  uniprot?: string | null;
  chebi?: string | null;
  compartment_name?: string | null;
  needs_resolution: string[];
  modifications?: { psi_mod: string | null; mod_label: string | null; residue: string | null; coordinate: number | null }[];
  components?: string[];
  members?: string[];
}

export interface ReactionSpec {
  key: string;
  name: string;
  reaction_type: string;
  inputs: string[];
  outputs: string[];
  catalyst: { entity: string; activity: { name: string | null; identifier: string | null } | null } | null;
  regulations: { kind: 'positive' | 'negative' | 'requirement'; regulator: string; note: string | null }[];
  summation: string;
  pmids: string[];
  evidence_ids: string[];
  preceding: string[];
  existing: ExistingRef | null;
}

/** The reactions and their entities as a graph (GET /sessions/{id}/network). Ids are prefixed: `e:` entity, `r:` reaction. */
export interface NetworkNode {
  id: string;
  type: 'entity' | 'reaction';
  key: string;
  label: string;
  openIssues: number;
  /** entity only */
  kind?: Participant['kind'];
  compartment?: string | null;
  unresolved?: string[];
  /** reaction only */
  reactionType?: string;
  dbId?: number | null;
  existingMatch?: 'same' | 'similar' | null;
}

export type NetworkEdgeType =
  'input' | 'output' | 'catalyst' | 'positive' | 'negative' | 'requirement' | 'component' | 'member' | 'precedes';

export interface NetworkEdge {
  id: string;
  type: NetworkEdgeType;
  source: string;
  target: string;
  label?: string | null;
}

export interface Network {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface ReactionDetail {
  reaction: ReactionSpec;
  dbId: number | null;
  participants: Record<string, Participant>;
  evidence: Evidence[];
}

export interface Passage {
  text: string;
  section: string | null;
  page: number | null;
  figure: string | null;
  charSpan: [number, number];
  score: number;
}

/** A pending edit. Nothing changes until a curator accepts it. */
export interface Proposal {
  id: string;
  reason: string;
  ops: Record<string, unknown>[];
  summary: string[];
  reaction_keys: string[];
  evidence: Evidence[];
  actor: string;
  status: 'pending' | 'accepted' | 'rejected' | 'stale';
  created: number;
  decided_by: string | null;
  decided_at: number | null;
}

export interface ProposalRequest {
  reason?: string;
  ops: Record<string, unknown>[];
  evidence?: Partial<Evidence>[];
  curator_assertion?: boolean;
}

export interface AcceptResponse {
  proposal: Proposal;
  reactions: { key: string; name: string; dbId: number | null }[];
  nOpenIssues: number;
}

export interface QAFinding {
  severity: IssueSeverity;
  code: string;
  message: string;
  field: string | null;
  source: 'rule' | 'llm';
}

/** Where a reaction goes in the curator's list: how much is wrong, not a pass/fail. */
export type QAPriority = 'fix_first' | 'fix' | 'review' | 'ok';

export const QA_PRIORITY_LABEL: Record<QAPriority, string> = {
  fix_first: 'Fix first',
  fix: 'Needs fixing',
  review: 'Worth a look',
  ok: 'No problems found'
};

export interface QAResult {
  reaction_key: string;
  reaction_name?: string | null;
  verdict: 'ok' | 'needs_work';
  /** Absent from an older service, which only sends the verdict. */
  priority?: QAPriority;
  /** One sentence: the most important thing to do about this reaction. */
  summary?: string | null;
  score: number | null;
  findings: QAFinding[];
  llm_used: boolean;
  /** The reviewer's answer to "is this a molecular reaction at all" (absent from an older service). */
  is_reaction?: boolean | null;
  not_reaction_reason?: string | null;
}

/** Language-model tokens, as the provider reports them. Cache reads and writes are reported separately. */
export interface UsageCounts {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export type UsageStep = 'extraction' | 'merge' | 'review' | 'draft' | 'qa' | 'chat' | 'combine';

/** One step's totals. `saved` marks a step whose numbers come from the saved run a replayed annotation was made from. */
export interface UsageStepRow extends UsageCounts {
  step: UsageStep;
  total_tokens: number;
  saved: boolean;
}

/** One recording: a pipeline step, a chat turn ("turn 3"), or a reaction check (the reaction's key). */
export interface UsageEntry extends UsageCounts {
  step: UsageStep;
  model: string | null;
  detail: string | null;
  at: number;
}

export interface UsageReport {
  source: 'run' | 'saved';
  entries: UsageEntry[];
  steps: UsageStepRow[];
  /** Everything listed, saved rows included. */
  totals: UsageCounts & { total_tokens: number };
  /** Only what was spent in this session (saved rows left out). */
  spent_now: UsageCounts & { total_tokens: number };
}

/** What POST /sessions/{id}/chat streams (server-sent events). */
export type ChatEvent =
  | { event: 'text'; data: { delta: string } }
  | { event: 'tool'; data: { name: string; input: Record<string, unknown> } }
  | { event: 'proposal'; data: Proposal }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: { proposalIds: string[]; usage?: UsageCounts } };

/** The instances a session wants staged: new instances with negative dbIds, shells for references. */
export interface SessionUserInstances {
  newInstances: Instance[];
  updatedInstances: Instance[];
  deletedInstances: Instance[];
  bookmarks: Instance[];
}

/** One stored chat message. `proposal_ids` are the edits an assistant reply proposed. */
export interface StoredChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
  proposal_ids: string[];
}
