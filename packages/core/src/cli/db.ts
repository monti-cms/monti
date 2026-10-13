import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type AppOptions, loadApp } from "./app";

export interface MigrateOptions extends AppOptions {
	/** List every body that could not be read, and the other per-body detail, instead of a short summary. */
	readonly verbose?: boolean;
	/** Read the bodies kept as unreadable again, with the config as it is now. */
	readonly reconvertBodies?: boolean;
}

/**
 * Writes the full per-body detail of a migration to `.monti/logs/migrate-<time>.log` under `cwd` and returns that path relative to `cwd` (with `/`).
 * Called only when there is something to report, so a clean run leaves no file.
 */
export function writeMigrateLog(cwd: string, lines: readonly string[], now: Date = new Date()): string {
	const stamp = now.toISOString().slice(0, 19).replaceAll(":", "-");
	const relative = `.monti/logs/migrate-${stamp}.log`;
	mkdirSync(path.join(cwd, ".monti/logs"), { recursive: true });
	writeFileSync(path.join(cwd, relative), `${lines.join("\n")}\n`);
	return relative;
}

/**
 * `monti db:migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and brings the tables up to date with this version of Monti.
 * Nothing set up yet is not migrated: it says to run `monti db:setup` and returns `false`.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function dbMigrate(options: MigrateOptions): Promise<boolean> {
	const log = options.log ?? console.log;
	const cms = await loadApp({ ...options, quiet: true });
	try {
		const state = await cms.databaseState();
		if (state && !state.set) {
			console.error(
				`Monti is not set up in this database yet (schema "${state.schema}"). Run \`monti db:setup\` first; \`monti db:migrate\` is for after you update Monti.`,
			);
			return false;
		}
		await cms.migrate({
			log,
			verbose: options.verbose,
			reconvertBodies: options.reconvertBodies,
			saveDetail: (lines) => writeMigrateLog(options.cwd ?? process.cwd(), lines),
		});
		return true;
	} catch (error) {
		console.error("Migration failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}

/**
 * `monti db:setup`: first-time setup. Creates the schema (when `DATABASE_SCHEMA` names one that is missing) and Monti's tables in an empty database.
 * When Monti's tables are already there it changes nothing and says so. Returns `true` on success.
 */
export async function dbSetup(options: AppOptions): Promise<boolean> {
	const cms = await loadApp({ ...options, quiet: true });
	try {
		await cms.setup({ log: options.log ?? console.log });
		return true;
	} catch (error) {
		console.error("Setup failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}
