/**
 * Backend response fixtures, in the exact JSON shape the server returns.
 *
 * This file is imported by BOTH the Karma unit suite and the Playwright E2E suite. That is
 * deliberate: the E2E tests mock `/api/**` at the network layer, and if they invented their
 * own payloads the two suites could drift until "all green" stopped meaning anything. One
 * definition of the server here means a backend contract change breaks both at once.
 *
 * Keep everything in this file plain JSON-serialisable data -- no `Map`, no class instances,
 * no imports from `@angular/*`. Playwright runs it in plain Node, outside the Angular
 * compiler.
 */

/** The username the mocked session belongs to. */
export const TEST_USER = 'test_curator';

/** A JWT-shaped token. Not signed -- the app only decodes it for the expiry claim. */
export const TEST_TOKEN = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  // { sub: 'test_curator', exp: 4102444800 }  (exp = 2100-01-01, so it never looks stale)
  'eyJzdWIiOiJ0ZXN0X2N1cmF0b3IiLCJleHAiOjQxMDI0NDQ4MDB9',
  'not-a-real-signature'
].join('.');

/**
 * The schema class tree, as `/getSchemaClassTree/` returns it. Trimmed to the branches the
 * views special-case, but structurally identical to production: nested `children`, `abstract`
 * flags, and per-class instance counts.
 */
export const SCHEMA_CLASS_TREE = {
  name: 'DatabaseObject',
  abstract: true,
  count: 1240,
  localCount: 0,
  children: [
    {
      name: 'Event',
      abstract: true,
      count: 620,
      localCount: 0,
      children: [
        { name: 'Pathway', abstract: false, count: 210, localCount: 210, children: [] },
        { name: 'Reaction', abstract: false, count: 410, localCount: 410, children: [] }
      ]
    },
    {
      name: 'PhysicalEntity',
      abstract: true,
      count: 500,
      localCount: 0,
      children: [
        { name: 'SimpleEntity', abstract: false, count: 180, localCount: 180, children: [] },
        { name: 'Complex', abstract: false, count: 120, localCount: 120, children: [] },
        {
          name: 'EntityWithAccessionedSequence',
          abstract: false,
          count: 200,
          localCount: 200,
          children: []
        }
      ]
    },
    { name: 'ReferenceGeneProduct', abstract: false, count: 90, localCount: 90, children: [] },
    { name: 'Person', abstract: false, count: 30, localCount: 30, children: [] }
  ]
};

/** The Java types the backend reports for scalar slots. */
const JAVA = {
  string: 'java.lang.String',
  integer: 'java.lang.Integer',
  float: 'java.lang.Float',
  boolean: 'java.lang.Boolean'
} as const;

/** A fully-qualified Reactome domain class, which is what marks a slot as instance-valued. */
function reactome(className: string): string {
  return `org.reactome.server.graph.domain.model.${className}`;
}

/**
 * Builds one attribute definition in wire format. Defaults to an optional, single-valued,
 * non-defining string.
 */
function attr(name: string, overrides: Record<string, any> = {}) {
  const { cardinality = '1', category = 'OPTIONAL', definingType = 'NONE_DEFINING',
    type = JAVA.string, origin = 'DatabaseObject' } = overrides;
  return {
    category,
    definingType,
    properties: {
      name,
      cardinality,
      origin: `org.reactome.server.graph.domain.model.${origin}`,
      attributeClasses: [{ type }]
    }
  };
}

/**
 * Attribute definitions per class, as `/getAttributes/{className}` returns them.
 *
 * This is the raw wire format, not the app's `SchemaAttribute`: each entry carries the
 * enum *names* for `category`/`definingType`, and everything else nested under `properties`
 * with fully-qualified Java class names. `InstanceUtilities.convertToSchemaClass` is what
 * turns it into a `SchemaClass` -- deriving the attribute's data type and allowed classes
 * from `attributeClasses[].type`, and the origin from the tail of the Java name. Writing the
 * fixture in the already-converted shape produced an instance view with no attribute rows at
 * all, so the wire format is what has to be mirrored here.
 */
export const CLASS_ATTRIBUTES: Record<string, any[]> = {
  Pathway: [
    attr('name', { cardinality: '+', category: 'REQUIRED', type: JAVA.string }),
    attr('definition'),
    attr('hasEvent', { cardinality: '+', type: reactome('Event') }),
    attr('species', { cardinality: '+', type: reactome('Species') }),
    attr('summation', { cardinality: '+', type: reactome('Summation') }),
    attr('literatureReference', { cardinality: '+', type: reactome('Publication') }),
    attr('doRelease', { type: JAVA.boolean }),
    attr('reviewStatus', { type: reactome('ReviewStatus') }),
    attr('created', { category: 'NOMANUALEDIT', type: reactome('InstanceEdit') }),
    attr('modified', {
      cardinality: '+', category: 'NOMANUALEDIT', type: reactome('InstanceEdit')
    })
  ],
  Reaction: [
    attr('name', { cardinality: '+', category: 'REQUIRED', type: JAVA.string }),
    attr('definition'),
    attr('input', { cardinality: '+', type: reactome('PhysicalEntity') }),
    attr('output', { cardinality: '+', type: reactome('PhysicalEntity') }),
    attr('catalystActivity', { cardinality: '+', type: reactome('CatalystActivity') }),
    attr('species', { cardinality: '+', type: reactome('Species') }),
    attr('reviewStatus', { type: reactome('ReviewStatus') })
  ],
  SimpleEntity: [
    attr('name', { cardinality: '+', category: 'REQUIRED', type: JAVA.string }),
    attr('referenceEntity', { type: reactome('ReferenceMolecule') }),
    attr('compartment', { cardinality: '+', type: reactome('Compartment') })
  ],
  Complex: [
    attr('name', { cardinality: '+', category: 'REQUIRED', type: JAVA.string }),
    attr('hasComponent', { cardinality: '+', type: reactome('PhysicalEntity') }),
    attr('compartment', { cardinality: '+', type: reactome('Compartment') })
  ],
  EntityWithAccessionedSequence: [
    attr('name', { cardinality: '+', category: 'REQUIRED', type: JAVA.string }),
    attr('referenceEntity', { type: reactome('ReferenceGeneProduct') }),
    attr('hasModifiedResidue', { cardinality: '+', type: reactome('AbstractModifiedResidue') }),
    attr('startCoordinate', { type: JAVA.integer }),
    attr('endCoordinate', { type: JAVA.integer })
  ],
  ReferenceGeneProduct: [
    attr('identifier', { category: 'REQUIRED' }),
    attr('geneName', { cardinality: '+' }),
    attr('referenceDatabase', { type: reactome('ReferenceDatabase') })
  ],
  Species: [attr('name', { cardinality: '+', category: 'REQUIRED', type: JAVA.string })],
  Person: [
    attr('surname', { category: 'REQUIRED' }),
    attr('firstname'),
    attr('initial')
  ]
};

/**
 * Instances keyed by dbId, as `/findByDbId/{dbId}` returns them: `attributes` is a plain
 * JSON object (the app converts it to a Map on receipt), and instance-valued slots hold
 * shells with dbId + displayName + schemaClassName.
 */
export const INSTANCES: Record<number, any> = {
  100: {
    dbId: 100,
    displayName: 'Glycolysis',
    schemaClassName: 'Pathway',
    attributes: {
      name: ['Glycolysis', 'glycolytic pathway'],
      definition: 'The conversion of glucose to pyruvate.',
      hasEvent: [
        shell(101, 'Glucose + ATP => Glucose-6-phosphate + ADP', 'Reaction'),
        shell(102, 'Glucose-6-phosphate => Fructose-6-phosphate', 'Reaction')
      ],
      species: [shell(48887, 'Homo sapiens', 'Species')],
      doRelease: true
    }
  },
  101: {
    dbId: 101,
    displayName: 'Glucose + ATP => Glucose-6-phosphate + ADP',
    schemaClassName: 'Reaction',
    attributes: {
      name: ['Glucose + ATP => Glucose-6-phosphate + ADP'],
      input: [shell(201, 'glucose', 'SimpleEntity'), shell(203, 'ATP', 'SimpleEntity')],
      output: [shell(202, 'glucose-6-phosphate', 'SimpleEntity'), shell(204, 'ADP', 'SimpleEntity')],
      species: [shell(48887, 'Homo sapiens', 'Species')]
    }
  },
  102: {
    dbId: 102,
    displayName: 'Glucose-6-phosphate => Fructose-6-phosphate',
    schemaClassName: 'Reaction',
    attributes: {
      name: ['Glucose-6-phosphate => Fructose-6-phosphate'],
      input: [shell(202, 'glucose-6-phosphate', 'SimpleEntity')],
      output: [shell(205, 'fructose-6-phosphate', 'SimpleEntity')],
      species: [shell(48887, 'Homo sapiens', 'Species')]
    }
  },
  201: entity(201, 'glucose'),
  202: entity(202, 'glucose-6-phosphate'),
  203: entity(203, 'ATP'),
  204: entity(204, 'ADP'),
  205: entity(205, 'fructose-6-phosphate'),
  48887: { dbId: 48887, displayName: 'Homo sapiens', schemaClassName: 'Species', attributes: {} },
  1: {
    dbId: 1,
    displayName: 'Curator, Test',
    schemaClassName: 'Person',
    attributes: { surname: 'Curator', firstname: 'Test' }
  }
};

function shell(dbId: number, displayName: string, schemaClassName: string) {
  return { dbId, displayName, schemaClassName };
}

function entity(dbId: number, displayName: string) {
  return {
    dbId,
    displayName,
    schemaClassName: 'SimpleEntity',
    attributes: { name: [displayName] }
  };
}

/**
 * The event tree, as `/getEventTree/{species}` returns it.
 *
 * A **flat array of top-level events**, not a single root: `DataService.fetchEventTree` wraps
 * whatever comes back in a synthetic `TopLevelPathway` root of its own
 * (`attributes: { hasEvent: data }`). Returning one object here instead of an array makes that
 * wrapper's `hasEvent` a non-iterable object, and the tree then dies in
 * `mergeLocalChangesToEventTree` with "event.attributes.hasEvent is not iterable", leaving the
 * event view stuck on its loading spinner.
 *
 * `hasDiagram` marks which pathways can open a diagram; children nest under `attributes.hasEvent`.
 */
export const EVENT_TREE = [
  {
    dbId: 100,
    displayName: 'Glycolysis',
    schemaClassName: 'Pathway',
    attributes: {
      hasDiagram: true,
      speciesName: 'Homo sapiens',
      doRelease: true,
      hasEvent: [
        {
          dbId: 101,
          displayName: 'Glucose + ATP => Glucose-6-phosphate + ADP',
          schemaClassName: 'Reaction',
          attributes: { speciesName: 'Homo sapiens', doRelease: true, hasEvent: [] }
        },
        {
          dbId: 102,
          displayName: 'Glucose-6-phosphate => Fructose-6-phosphate',
          schemaClassName: 'Reaction',
          attributes: { speciesName: 'Homo sapiens', doRelease: true, hasEvent: [] }
        }
      ]
    }
  }
];

/** A page of instances, as `/listInstances/` and `/searchInstances/` return it. */
export function instanceListPage(dbIds: number[], totalCount?: number) {
  return {
    instances: dbIds.map(id => {
      const inst = INSTANCES[id];
      return shell(inst.dbId, inst.displayName, inst.schemaClassName);
    }),
    totalCount: totalCount ?? dbIds.length
  };
}

/** The default Pathway listing page. */
export const PATHWAY_LIST = instanceListPage([100], 1);

/** The default Reaction listing page. */
export const REACTION_LIST = instanceListPage([101, 102], 2);

/** Referrer groups, as `/getReferrers/{dbId}` returns them. */
export const REFERRERS: Record<number, any[]> = {
  101: [{ attributeName: 'hasEvent', referrers: [shell(100, 'Glycolysis', 'Pathway')] }],
  202: [
    {
      attributeName: 'output',
      referrers: [shell(101, 'Glucose + ATP => Glucose-6-phosphate + ADP', 'Reaction')]
    },
    {
      attributeName: 'input',
      referrers: [shell(102, 'Glucose-6-phosphate => Fructose-6-phosphate', 'Reaction')]
    }
  ]
};

/**
 * An empty staged-edit bundle, as `/loadInstances/{user}` returns for a fresh session.
 *
 * `defaultPerson` is a *shell*, which is what the app itself persists
 * (`DataService.cloneUserInstances` puts it through `makeShell`). Giving it full `attributes`
 * here is not just wasteful, it breaks the app: `hydrateUserInstances` converts the attribute
 * objects of the new/updated/deleted buckets into Maps but deliberately leaves
 * `defaultPerson` alone, so a plain object reaching the store makes the ngrx effect's
 * `stringifyInstance` throw "object is not iterable" on `Object.fromEntries`.
 */
export const EMPTY_USER_INSTANCES = {
  newInstances: [],
  updatedInstances: [],
  deletedInstances: [],
  bookmarks: [],
  defaultPerson: shell(1, 'Curator, Test', 'Person')
};

/** A QA report with one passing and one failing check, as `/qaReport/` returns it. */
export const QA_REPORT = {
  instance: shell(100, 'Glycolysis', 'Pathway'),
  qaResults: [
    { checkName: 'Compartment consistency', passed: true },
    {
      checkName: 'Missing species',
      passed: false,
      columns: ['DB_ID', 'Display name', 'Issue'],
      rows: [['102', 'Glucose-6-phosphate => Fructose-6-phosphate', 'species is empty']]
    }
  ]
};

/**
 * A minimal but renderable pathway diagram for dbId 100, in the layout format
 * `/fetchPathwayDiagramForPathway/` returns: two reaction nodes plus their edges inside one
 * compartment.
 */
export const PATHWAY_DIAGRAM = {
  dbId: 900,
  stableId: 'R-HSA-100',
  displayName: 'Glycolysis',
  isDisease: false,
  nodes: [
    diagramNode(201, 'glucose', 100, 100),
    diagramNode(202, 'glucose-6-phosphate', 400, 100),
    diagramNode(205, 'fructose-6-phosphate', 700, 100)
  ],
  edges: [
    diagramEdge(101, 250, 100),
    diagramEdge(102, 550, 100)
  ],
  compartments: [],
  links: [],
  notes: [],
  shadows: []
};

function diagramNode(reactomeId: number, displayName: string, x: number, y: number) {
  return {
    id: reactomeId,
    reactomeId,
    displayName,
    schemaClass: 'SimpleEntity',
    renderableClass: 'Chemical',
    position: { x, y },
    prop: { x, y, width: 120, height: 40 },
    bgColor: null,
    fgColor: null,
    isDisease: false,
    isFadeOut: false,
    isCrossed: false,
    connectors: []
  };
}

function diagramEdge(reactomeId: number, x: number, y: number) {
  return {
    id: reactomeId,
    reactomeId,
    displayName: INSTANCES[reactomeId]?.displayName ?? `Reaction ${reactomeId}`,
    schemaClass: 'Reaction',
    renderableClass: 'Reaction',
    reactionType: 'transition',
    position: { x, y },
    segments: [],
    inputs: [],
    outputs: [],
    catalysts: [],
    activators: [],
    inhibitors: [],
    isDisease: false,
    isFadeOut: false
  };
}

/**
 * A single place to describe every endpoint the app calls, so the Playwright router and any
 * `HttpTestingController`-based spec can be built from the same list rather than from
 * hand-written URL strings that silently stop matching.
 *
 * `match` is tested against the request path (no origin, no query string).
 */
export interface ApiRouteFixture {
  /** Human-readable name, used in test output when a route goes unmocked. */
  name: string;
  /** Path predicate. */
  match: (path: string) => boolean;
  /** Response body, or a function of the path for parameterised routes. */
  body: unknown | ((path: string) => unknown);
  /** HTTP status. Defaults to 200. */
  status?: number;
}

/** Pulls the trailing numeric path segment, e.g. `/api/curation/findByDbId/100` -> 100. */
export function trailingId(path: string): number {
  const match = path.match(/(-?\d+)\/?$/);
  return match ? Number(match[1]) : NaN;
}

/** Pulls the trailing non-numeric path segment, e.g. `/getAttributes/Pathway` -> 'Pathway'. */
export function trailingName(path: string): string {
  return decodeURIComponent(path.replace(/\/$/, '').split('/').pop() ?? '');
}

/**
 * The default mock backend: every endpoint the app touches during the flows the E2E suite
 * exercises. Order matters -- the first matching route wins, so put specific paths before
 * general ones.
 */
export const DEFAULT_API_ROUTES: ApiRouteFixture[] = [
  {
    name: 'login',
    match: p => p.includes('/auth/login'),
    // The bare token string, not an object: AuthenticateService.login passes the response
    // body straight through as the token, and LoginComponent puts it in localStorage as-is.
    // Wrapping it in { token } stores "[object Object]", which then fails to decode and
    // bounces the curator back to /login.
    body: TEST_TOKEN
  },
  { name: 'refresh token', match: p => p.includes('/auth/refresh'), body: TEST_TOKEN },
  { name: 'logout', match: p => p.includes('/auth/logout'), body: {} },
  { name: 'schema class tree', match: p => p.includes('/getSchemaClassTree'), body: SCHEMA_CLASS_TREE },
  {
    name: 'class attributes',
    match: p => p.includes('/getAttributes/'),
    body: p => CLASS_ATTRIBUTES[trailingName(p)] ?? []
  },
  {
    name: 'event tree',
    match: p => p.includes('/getEventTree'),
    body: EVENT_TREE
  },
  {
    name: 'list instances',
    match: p => p.includes('/listInstances'),
    body: p => (p.includes('Reaction') ? REACTION_LIST : PATHWAY_LIST)
  },
  {
    name: 'search instances',
    match: p => p.includes('/searchInstances'),
    body: PATHWAY_LIST
  },
  {
    name: 'find by display name',
    match: p => p.includes('/findByDisplayName'),
    body: PATHWAY_LIST
  },
  {
    name: 'find by dbId',
    match: p => p.includes('/findByDbId'),
    body: p => INSTANCES[trailingId(p)] ?? null
  },
  {
    name: 'referrers',
    match: p => p.includes('/getReferrers'),
    body: p => REFERRERS[trailingId(p)] ?? []
  },
  {
    name: 'load staged instances',
    match: p => p.includes('/loadInstances'),
    body: EMPTY_USER_INSTANCES
  },
  { name: 'persist staged instances', match: p => p.includes('/persistInstances'), body: {} },
  { name: 'delete persisted', match: p => p.includes('/deletePersistedInstances'), body: {} },
  { name: 'list backups', match: p => p.includes('/listUserInstanceBackups'), body: [] },
  { name: 'qa report', match: p => p.includes('/qaReport'), body: QA_REPORT },
  { name: 'qa check report', match: p => p.includes('/getTestQACheckReport'), body: [] },
  {
    name: 'pathway diagram',
    match: p => p.includes('/fetchPathwayDiagramForPathway') || p.includes('/diagram'),
    body: PATHWAY_DIAGRAM
  },
  { name: 'display names by dbIds', match: p => p.includes('/findDisplayNamesByDbIds'), body: [] },
  { name: 'reaction structures', match: p => p.includes('/findReactionStructuresByDbIds'), body: [] },
  { name: 'modified residues', match: p => p.includes('/findModifiedResiduesByDbIds'), body: [] },
  { name: 'match instances', match: p => p.includes('/matchInstances'), body: [] },

  // Diagram editing: locks and the saved cytoscape network. Listed before the generic
  // `/diagram` route because they are more specific paths on the same feature.
  { name: 'all diagram locks', match: p => p.includes('/getDiagramLocks'), body: [] },
  // null means "not locked", which is what leaves the diagram read-only until the curator
  // asks to edit it.
  { name: 'is diagram locked', match: p => p.includes('/hasDiagramLocked'), body: null },
  {
    name: 'lock diagram',
    match: p => p.includes('/lockDiagram'),
    body: p => ({
      diagramDbId: trailingId(p),
      username: TEST_USER,
      lockedAt: '2026-01-01T00:00:00Z',
      lockId: 'test-lock-1',
      hasBackupDiagram: false
    })
  },
  { name: 'unlock diagram', match: p => p.includes('/unlockDiagram'), body: true },
  { name: 'has cy network', match: p => p.includes('/hasCyNetwork'), body: false },
  { name: 'has diagram', match: p => p.includes('/hasDiagram'), body: true },
  { name: 'get cy network', match: p => p.includes('/getCyNetwork'), body: null },
  { name: 'load backup cy network', match: p => p.includes('/loadBackupCyNetwork'), body: null },
  { name: 'backup cy network', match: p => p.includes('/backupCyNetwork'), body: true },
  { name: 'upload cy network', match: p => p.includes('/uploadCyNetwork'), body: true },

  // Auto-fillers. Each echoes an unchanged instance back, so a post-edit operation is a
  // no-op unless a test overrides it.
  { name: 'fill reference sequence', match: p => p.includes('/fillRefSequence'), body: {} },
  { name: 'fill ChEBI', match: p => p.includes('/fillChEBI'), body: {} },
  { name: 'fill external ontology', match: p => p.includes('/fillExternalOntology'), body: {} },
  { name: 'fill reference', match: p => p.includes('/fillReference'), body: {} },

  { name: 'export event docx', match: p => p.includes('/exportEventDocx'), body: {} },
  { name: 'get backup', match: p => p.includes('/getUserInstanceBackup'), body: EMPTY_USER_INSTANCES },

  {
    name: 'commit',
    // The server echoes the committed instance back with its persisted dbId.
    match: p => p.includes('/commit'),
    body: { dbId: 5000, displayName: 'Glycolysis', schemaClassName: 'Pathway', attributes: {} }
  },
  // Both delete-by-deleted and the plain delete answer true. Keep the specific one first: the
  // generic matcher below would otherwise swallow it.
  { name: 'delete by deleted', match: p => p.includes('/deleteByDeleted'), body: true },
  { name: 'delete', match: p => p.includes('/delete'), body: true }
];
