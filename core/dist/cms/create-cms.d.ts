import type { CmsConfig } from "../config/define.js";
export type * from "./types.js";
import type { Cms, CmsHost, CreateCmsOptions } from "./types.js";
/** The request handler of an instance, loading the route code on the first request. */
export declare function lazyHandle(cms: () => Cms): Cms["handle"];
/**
 * Creates the CMS instance from a site config and a server config. An app does not call this: `defineConfig` of `@monti-cms/core/server` (what `monti.config.ts`
 * uses) takes the site options and the server options together and calls it. It stays for code that builds the two parts itself (tests, tools):
 *
 * ```ts
 * import { defineSite } from "@monti-cms/core"; // the site config only
 * export const cms = createCms({ config: defineSite({ schema, plugins }), server: { database: postgres(), auth: auth({ ... }) } });
 * ```
 *
 * Any number of instances live in one process, each with its own config and server config: nothing is read from a module or the environment except the
 * connections of the server config.
 */
export declare function createCms<const Config extends CmsConfig>(options: CreateCmsOptions<Config>): CmsHost<Config>;
