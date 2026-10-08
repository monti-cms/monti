import type { Decision } from "../server/decision.js";
type Env = Readonly<Record<string, string | undefined>>;
/** What the instance decided on its own besides what the database and login adapters report: host trust, the site URL, the schema file. */
export declare function coreDecisions(input: {
    readonly env: Env;
    readonly trust: {
        readonly trusted: boolean;
        readonly source: string;
    };
    readonly siteUrl: string | undefined;
    readonly siteUrlSource: string | undefined;
    /** The schema file, relative to the working directory, or `undefined` when the site has none. */
    readonly schemaFile: string | undefined;
    readonly schemaFileGiven: boolean;
    readonly hotReload: boolean;
}): readonly Decision[];
export {};
