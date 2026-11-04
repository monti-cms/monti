import path from "node:path";
import { type MontiConfig, openMonti } from "../config";
import { migrateToLatest } from "../db/migrations";
import { runCli } from "../entry/cli";
import { migrateContent } from "../schema/apply";
import { readChangeFiles } from "../schema/files";

const MAINTENANCE = `Maintenance commands (not operations):
  db:setup        create the tables and follow every change file
  db:migrate      follow the change files this database has not (run it on deploy)
  deliveries:run  send the webhook retries that are due`;

/**
 * `monti <command>`: the maintenance commands, and every operation as a command (`monti help` lists them). `config` is `monti.config.ts`, loaded by
 * the bin; `root` is the site folder.
 */
export async function main(config: MontiConfig, root: string, argv: string[]): Promise<number> {
	const monti = openMonti(config, root);
	const io = { out: (line: string) => console.log(line), err: (line: string) => console.error(line) };
	try {
		const [command] = argv;
		if (command === "db:setup" || command === "db:migrate") {
			await migrateToLatest(monti.db);
			const applied = await migrateContent(
				monti.db,
				config.schema,
				await readChangeFiles(path.join(root, "monti", "changes")),
			);
			io.out(applied.length > 0 ? `Applied ${applied.join(", ")}.` : "The database is up to date.");
			return 0;
		}
		if (command === "deliveries:run") {
			await monti.deliveries.sendDue();
			return 0;
		}
		if (!command || command === "help") io.out(`${MAINTENANCE}\n\nOperations:`);
		return await runCli(monti, argv, io);
	} finally {
		await monti.db.destroy();
	}
}
