import type { ServerPlugins } from "../plugin/server.js";
import type { Site } from "../site/index.js";
import type { SharedConnections } from "./connections.js";
import type { Cms } from "./types.js";
/**
 * The commands that create or update the tables (`monti db:setup`, `monti db:migrate`): the core tables first (the database adapter's `migrate`), then each
 * plugin's `migrate` hook. The messages go to `log`; the command-line tool prints the first and last line itself.
 */
export declare function createMigrator(parts: {
    readonly connections: Pick<SharedConnections, "database">;
    readonly site: Site;
    readonly plugins: Pick<ServerPlugins, "formats" | "migrate">;
}): Pick<Cms, "migrate" | "databaseState" | "setup">;
