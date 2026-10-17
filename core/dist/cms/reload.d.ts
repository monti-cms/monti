import type { CmsConfig } from "../config/define.js";
import type { CmsServerConfig } from "../server/define.js";
import type { CmsHost, CreateCmsOptions } from "./types.js";
/** The members of an instance that are not rebuilt with the site. */
export type SchemaMembers = "schemaFile" | "forSchema" | "reloadSchema" | "decisions";
/**
 * Puts the parts that depend on the schema (`build`: the site, the stores, the services, the read API) together with the members that do not (`schemaFile`,
 * `forSchema`, `reloadSchema`, `decisions`) into the instance. `reloadSchema` rebuilds the parts in place, in development: `site` is a getter, and every other part is
 * assigned over, so the cache of `cms.plugin(name).once` starts afresh with them.
 */
export declare function withSchemaControls<Config extends CmsConfig>(parts: {
    readonly options: CreateCmsOptions<Config>;
    readonly server: CmsServerConfig;
    readonly build: (config: Config, self: () => CmsHost<Config>) => Omit<CmsHost<Config>, SchemaMembers>;
}): CmsHost<Config>;
