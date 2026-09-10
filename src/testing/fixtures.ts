/**
 * Domain-object factories for tests.
 *
 * Every factory takes an optional partial override so a spec can state only the field it
 * actually cares about. Keeping the defaults here means a change to the Instance/SchemaClass
 * shape is a one-file fix rather than a sweep through every spec.
 *
 * See also `api-fixtures.ts`, which wraps these in the JSON envelopes the backend returns --
 * that file is shared with the Playwright suite so unit tests and E2E tests agree on what
 * the server looks like.
 */

import { QAReport, QAResults } from '../app/core/models/qa-report.model';
import { Instance, InstanceList, Referrer, UserInstances } from '../app/core/models/reactome-instance.model';
import {
  AttributeCategory,
  AttributeDataType,
  AttributeDefiningType,
  SchemaAttribute,
  SchemaClass
} from '../app/core/models/reactome-schema.model';

/** Counter for factories called without an explicit dbId, so ids stay distinct within a spec. */
let nextDbId = 1000;

/** Reset the auto-dbId counter. Call from a top-level `beforeEach` if a spec asserts on exact ids. */
export function resetFixtureIds(): void {
  nextDbId = 1000;
}

/**
 * A single schema attribute. Defaults to the most common case in the model: an optional,
 * single-valued, non-defining string.
 */
export function makeAttribute(name: string, overrides: Partial<SchemaAttribute> = {}): SchemaAttribute {
  return {
    name,
    cardinality: '1',
    origin: 'DatabaseObject',
    category: AttributeCategory.OPTIONAL,
    definingType: AttributeDefiningType.NONE_DEFINING,
    type: AttributeDataType.STRING,
    ...overrides
  };
}

/** A multi-valued instance-typed attribute, e.g. `hasEvent` or `input`. */
export function makeInstanceAttribute(
  name: string,
  allowedClases: string[],
  overrides: Partial<SchemaAttribute> = {}
): SchemaAttribute {
  return makeAttribute(name, {
    cardinality: '+',
    type: AttributeDataType.INSTANCE,
    allowedClases,
    ...overrides
  });
}

/**
 * A schema class. `attributes` defaults to the two slots almost every view touches
 * (`_displayName` is not a real slot, so only `displayName`-adjacent ones are included).
 */
export function makeSchemaClass(name: string, overrides: Partial<SchemaClass> = {}): SchemaClass {
  return {
    name,
    abstract: false,
    attributes: [
      makeAttribute('name', { cardinality: '+', category: AttributeCategory.REQUIRED }),
      makeAttribute('definition')
    ],
    ...overrides
  };
}

/**
 * An Instance. `attributes` is a real `Map`, which is what the app uses at runtime -- passing a
 * plain object here is the single most common reason a component spec fails in a way that looks
 * like a component bug.
 */
export function makeInstance(overrides: Partial<Instance> = {}): Instance {
  const dbId = overrides.dbId ?? nextDbId++;
  const instance: Instance = {
    dbId,
    displayName: `Instance ${dbId}`,
    schemaClassName: 'Pathway',
    ...overrides
  };
  // Normalise after the spread so a spec may pass a plain object for convenience, and so a
  // Map passed in is copied rather than aliased into the fixture.
  instance.attributes = toAttributeMap(overrides.attributes);
  return instance;
}

/** A new (uncommitted) instance: negative dbId and the placeholder display name. */
export function makeNewInstance(overrides: Partial<Instance> = {}): Instance {
  return makeInstance({
    dbId: -1,
    displayName: 'To be generated',
    ...overrides
  });
}

/** A shell instance -- dbId and displayName only, no attributes, as returned inside a slot value. */
export function makeShellInstance(dbId: number, displayName: string, schemaClassName = 'Pathway'): Instance {
  return { dbId, displayName, schemaClassName };
}

/** Accepts a Map, a plain object, or nothing, and always returns a Map. */
export function toAttributeMap(attributes: Map<string, any> | Record<string, any> | undefined): Map<string, any> {
  if (attributes instanceof Map) return new Map(attributes);
  if (attributes) return new Map(Object.entries(attributes));
  return new Map<string, any>();
}

/** An `InstanceList` page as returned by listInstances/searchInstances. */
export function makeInstanceList(instances: Instance[] = [], totalCount?: number): InstanceList {
  return { instances, totalCount: totalCount ?? instances.length };
}

/** An empty `InstanceList`. The default return value for list/search doubles. */
export const EMPTY_INSTANCE_LIST: InstanceList = { instances: [], totalCount: 0 };

/** A `Referrer` group -- one attribute name plus the instances pointing through it. */
export function makeReferrer(attributeName: string, referrers: Instance[]): Referrer {
  return { attributeName, referrers };
}

/** The staged-edit bundle persisted per user. All buckets default to empty. */
export function makeUserInstances(overrides: Partial<UserInstances> = {}): UserInstances {
  return {
    newInstances: [],
    updatedInstances: [],
    deletedInstances: [],
    bookmarks: [],
    ...overrides
  };
}

/** A single QA check result. Defaults to a passing check with no rows. */
export function makeQAResult(checkName: string, overrides: Partial<QAResults> = {}): QAResults {
  return {
    checkName,
    passed: true,
    ...overrides
  };
}

/** A failing QA check, with its column names and offending rows. */
export function makeFailedQAResult(checkName: string, columns: string[], rows: string[][]): QAResults {
  return { checkName, passed: false, columns, rows };
}

/** A QA report for one instance. Defaults to a single passing check. */
export function makeQAReport(instance: Instance = makeInstance(), qaResults?: QAResults[]): QAReport {
  return {
    instance,
    qaResults: qaResults ?? [makeQAResult('Compartment check')]
  };
}

/**
 * A small but structurally complete pathway hierarchy, useful for event-tree and diagram specs:
 * a top-level Pathway with two child Reactions, each with one input and one output.
 */
export function makePathwayHierarchy(): {
  pathway: Instance;
  reactions: Instance[];
  entities: Instance[];
} {
  const entities = [
    makeInstance({ dbId: 201, displayName: 'A', schemaClassName: 'SimpleEntity' }),
    makeInstance({ dbId: 202, displayName: 'B', schemaClassName: 'SimpleEntity' }),
    makeInstance({ dbId: 203, displayName: 'C', schemaClassName: 'SimpleEntity' })
  ];

  const reactions = [
    makeInstance({
      dbId: 101,
      displayName: 'A -> B',
      schemaClassName: 'Reaction',
      attributes: new Map<string, any>([
        ['input', [entities[0]]],
        ['output', [entities[1]]]
      ])
    }),
    makeInstance({
      dbId: 102,
      displayName: 'B -> C',
      schemaClassName: 'Reaction',
      attributes: new Map<string, any>([
        ['input', [entities[1]]],
        ['output', [entities[2]]]
      ])
    })
  ];

  const pathway = makeInstance({
    dbId: 100,
    displayName: 'Test pathway',
    schemaClassName: 'Pathway',
    attributes: new Map<string, any>([
      ['hasEvent', reactions],
      ['speciesName', ['Homo sapiens']]
    ])
  });

  return { pathway, reactions, entities };
}

/**
 * A minimal schema class tree rooted at DatabaseObject, covering the branches the views
 * special-case (Event, PhysicalEntity, Regulation, ReferenceGeneProduct).
 *
 * The `count`/`localCount` numbers deliberately match `SCHEMA_CLASS_TREE` in
 * `api-fixtures.ts`, so a unit spec and an E2E spec asserting on the same class see the same
 * figure. Keep the two in step when editing either.
 */
export function makeSchemaClassTree(): SchemaClass {
  const reaction = makeSchemaClass('Reaction', { count: 410, localCount: 410 });
  const pathway = makeSchemaClass('Pathway', {
    count: 210,
    localCount: 210,
    attributes: [
      makeInstanceAttribute('hasEvent', ['Event']),
      makeAttribute('name', { cardinality: '+', category: AttributeCategory.REQUIRED })
    ]
  });
  const event = makeSchemaClass('Event', {
    abstract: true, count: 620, localCount: 0, children: [pathway, reaction]
  });

  const simpleEntity = makeSchemaClass('SimpleEntity', { count: 180, localCount: 180 });
  const complex = makeSchemaClass('Complex', {
    count: 120,
    localCount: 120,
    attributes: [makeInstanceAttribute('hasComponent', ['PhysicalEntity'])]
  });
  const ewas = makeSchemaClass('EntityWithAccessionedSequence', { count: 200, localCount: 200 });
  const physicalEntity = makeSchemaClass('PhysicalEntity', {
    abstract: true,
    count: 500,
    localCount: 0,
    children: [simpleEntity, complex, ewas]
  });

  const regulation = makeSchemaClass('Regulation', { abstract: true, count: 0, localCount: 0 });
  const referenceGeneProduct = makeSchemaClass('ReferenceGeneProduct', {
    count: 90, localCount: 90
  });

  const root = makeSchemaClass('DatabaseObject', {
    abstract: true,
    count: 1240,
    localCount: 0,
    children: [event, physicalEntity, regulation, referenceGeneProduct]
  });

  // Wire parents and descendant sets the way DataService does after a fetch, so that
  // isEventClass()/isDescendantSchemaClass() behave against this tree.
  linkSchemaTree(root);
  return root;
}

/** Sets `parent` and `descendants` throughout a schema tree, as DataService does on load. */
export function linkSchemaTree(root: SchemaClass): SchemaClass {
  const visit = (cls: SchemaClass): Set<string> => {
    const descendants = new Set<string>([cls.name]);
    for (const child of cls.children ?? []) {
      child.parent = cls;
      for (const name of visit(child)) descendants.add(name);
    }
    cls.descendants = descendants;
    return descendants;
  };
  visit(root);
  return root;
}

/** Flattens a schema tree into a name -> class map, matching DataService's internal cache. */
export function flattenSchemaTree(root: SchemaClass): Map<string, SchemaClass> {
  const map = new Map<string, SchemaClass>();
  const visit = (cls: SchemaClass) => {
    map.set(cls.name, cls);
    (cls.children ?? []).forEach(visit);
  };
  visit(root);
  return map;
}
