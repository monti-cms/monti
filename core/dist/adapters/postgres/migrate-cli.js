import { runMigrate } from "./run-migrate.js";
/**
 * Legacy entry point (`import "@monti-cms/core/migrate"`): importing it creates the tables right away. New apps use the `monti migrate` command.
 *
 * ```sh
 * tsx --env-file=.env.local --import @monti-cms/core/register migrate.ts   # migrate.ts: import "@monti-cms/core/migrate";
 * ```
 */
void runMigrate().then((ok) => {
    if (!ok)
        process.exitCode = 1;
});
