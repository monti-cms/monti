import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadApp } from "./app.js";
/**
 * Writes the full per-body detail of a migration to `.monti/logs/migrate-<time>.log` under `cwd` and returns that path relative to `cwd` (with `/`).
 * Called only when there is something to report, so a clean run leaves no file.
 */
export function writeMigrateLog(cwd, lines, now = new Date()) {
    const stamp = now.toISOString().slice(0, 19).replaceAll(":", "-");
    const relative = `.monti/logs/migrate-${stamp}.log`;
    mkdirSync(path.join(cwd, ".monti/logs"), { recursive: true });
    writeFileSync(path.join(cwd, relative), `${lines.join("\n")}\n`);
    return relative;
}
/**
 * `monti migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and creates the tables in the store.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function migrate(options) {
    const cms = await loadApp(options);
    try {
        await cms.migrate({
            log: options.log ?? console.log,
            verbose: options.verbose,
            reconvertBodies: options.reconvertBodies,
            saveDetail: (lines) => writeMigrateLog(options.cwd ?? process.cwd(), lines),
        });
        return true;
    }
    catch (error) {
        console.error("Migration failed:", error);
        return false;
    }
    finally {
        await cms.close();
    }
}
