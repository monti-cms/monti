import config from "@cms-config";
/**
 * The only place that reads the host app's site config (`cms.config.ts`). The app points the `@cms-config` alias at its own config file
 * (`withCms`, tsconfig `paths`, test setup). CMS code never imports the config file directly and goes through here instead.
 *
 * The authoring API (the `@monti-cms/core` entry point) does not import this file: the config file imports the authoring API, so it would form a cycle.
 */
export type ResolvedConfig = typeof config;
/**
 * Spell the type out as `ResolvedConfig`. Otherwise the published type declarations (`dist/*.d.ts`) freeze the type of the empty config used at build time
 * and the app's collection names collapse to `string`.
 */
export declare const cmsConfig: ResolvedConfig;
