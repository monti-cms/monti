/**
 * Creates the tables in the store from the server config (`cms.server.ts`) or brings them up to date (including plugin tables). Running it repeatedly gives the same result.
 * Called by the `monti migrate` command. Returns `true` on success.
 */
export declare function runMigrate(log?: (message: string) => void): Promise<boolean>;
