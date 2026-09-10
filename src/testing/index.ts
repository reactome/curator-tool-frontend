/**
 * Test harness barrel. Import everything a spec needs from `src/testing`:
 *
 *   import { commonTestProviders, componentTestImports, makeInstance } from 'src/testing';
 *
 * `api-fixtures` is intentionally NOT re-exported here: it is also consumed by the Playwright
 * suite from plain Node, and going through this barrel would drag in the Angular imports that
 * the other modules make. Import it directly as `src/testing/api-fixtures`.
 */

export * from './fixtures';
export * from './mock-store';
export * from './test-doubles';
export * from './test-providers';
