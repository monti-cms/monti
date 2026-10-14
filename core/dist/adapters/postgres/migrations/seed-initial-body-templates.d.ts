import type { MigrationUp } from "./types.js";
/**
 * Seeds the site config's initial body templates into a new store. It is a run-once job of its own, not a schema step: it runs after every step, and a
 * store that already seeded does not seed again, so deleted templates are not revived.
 */
export declare const seedInitialBodyTemplates: MigrationUp;
