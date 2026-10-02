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

export interface Job {
  id: string;
  status: JobStatus;
  progress: string;
  error: string | null;
}

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
}

export interface ReactionRef {
  key: string;
  name: string;
  dbId: number | null;
  evidenceIds: string[];
}

export interface SessionDetail extends SessionSummary {
  focus: string | null;
  error: string | null;
  reactions: ReactionRef[];
}

export interface Issue {
  id: string;
  source: 'evidence' | 'builder' | 'resolver' | 'emitter' | 'pipeline' | 'existing' | 'qa';
  severity: IssueSeverity;
  code: string;
  message: string;
  reaction_key: string | null;
  participant_key: string | null;
  instance_db_id: number | null;
  status: IssueStatus;
}

export type Verification = 'unverified' | 'exact' | 'fuzzy' | 'failed';

export interface Evidence {
  id: string;
  quote: string;
  pmid: string | null;
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

export interface QAResult {
  reaction_key: string;
  verdict: 'ok' | 'needs_work';
  score: number | null;
  findings: QAFinding[];
  llm_used: boolean;
}

/** Language-model tokens, as the provider reports them. Cache reads and writes are reported separately. */
export interface UsageCounts {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export type UsageStep = 'extraction' | 'merge' | 'review' | 'draft' | 'qa' | 'chat';

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
