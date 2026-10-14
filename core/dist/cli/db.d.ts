import { type AppOptions } from "./app.js";
export type MigrateOptions = AppOptions;
/**
 * `monti db:migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and brings the tables up to date with this version of Monti.
 * Nothing set up yet is not migrated: it says to run `monti db:setup` and returns 1.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns the exit code; an error (a database that cannot be reached, say) is thrown.
 */
export declare function dbMigrate(options: MigrateOptions): Promise<number>;
/**
 * `monti db:setup`: first-time setup. Creates the schema (when `DATABASE_SCHEMA` names one that is missing) and Monti's tables in an empty database.
 * When Monti's tables are already there it changes nothing and says so. Returns the exit code; an error is thrown.
 */
export declare function dbSetup(options: AppOptions): Promise<number>;
export declare const dbSetupCommand: import("./command.js").Command;
export declare const dbMigrateCommand: import("./command.js").Command;
