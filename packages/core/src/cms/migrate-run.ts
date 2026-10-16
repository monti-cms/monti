import type { ServerPlugins } from "../plugin/server";
import type { Site } from "../site";
import type { SharedConnections } from "./connections";
import type { CmsHost, MigrateRunOptions } from "./types";

/**
 * The commands that create or update the tables (`monti db:setup`, `monti db:migrate`): the core tables first (the database adapter's `migrate`), then each
 * plugin's `migrate` hook. The messages go to `log`; the command-line tool prints the first and last line itself.
 */
export function createMigrator(parts: {
	readonly connections: Pick<SharedConnections, "database">;
	readonly site: Site;
	readonly plugins: Pick<ServerPlugins, "formats" | "migrate">;
}): Pick<CmsHost, "migrate" | "databaseState" | "setup"> {
	const { connections, site, plugins } = parts;
	const { database } = connections;

	/** Runs the steps of the core tables and the plugins. */
	const run = async (
		{ log = console.log }: MigrateRunOptions,
		/** Where the line per plugin goes. First-time setup leaves it out: the plugin tables are in the count of created tables. */
		pluginLog: (message: string) => void = log,
	) => {
		const summary = await database.migrate({ site, formats: await plugins.formats() });
		await plugins.migrate(pluginLog);
		return { summary };
	};

	return {
		migrate: async (options = {}) => {
			const log = options.log ?? console.log;
			const target = database.inspector?.describeTarget();
			log("Bringing Monti's tables up to date with this version\u2026");
			log(`Database: ${target ?? database.name}`);
			const { summary } = await run(options);
			const applied = summary?.applied ?? 0;
			log(
				summary
					? applied === 0
						? "Already up to date."
						: `Applied ${applied} step${applied === 1 ? "" : "s"}, ${summary.upToDate} already up to date.`
					: "Done.",
			);
		},
		databaseState: async () => database.inspector?.state(),
		setup: async ({ log = console.log } = {}) => {
			const target = database.inspector?.describeTarget();
			const before = await database.inspector?.state();
			if (before?.set) {
				log(
					`Monti is already set up in this database (schema "${before.schema}"). After updating Monti, run \`monti db:migrate\`.`,
				);
				return { created: false, tables: 0 };
			}
			log(`Creating Monti's tables in ${target ?? `the ${database.name} database`}\u2026`);
			if (before && before.tables > 0) {
				log(
					`The schema "${before.schema}" already has ${before.tables} other table${before.tables === 1 ? "" : "s"}; Monti only adds its own and does not touch them.`,
				);
			}
			await run({ log }, () => undefined);
			const after = await database.inspector?.state();
			const tables = after ? after.tables - (before?.tables ?? 0) : 0;
			log(after ? `Done: created ${tables} table${tables === 1 ? "" : "s"}.` : "Done.");
			return { created: true, tables };
		},
	};
}
