import path from "node:path";
import { resetAdminPassword } from "../auth/reset";
import { type MontiConfig, openMonti } from "../config";
import { migrateToLatest } from "../db/migrations";
import { runCli } from "../entry/cli";
import { migrateContent } from "../schema/apply";
import { readChangeFiles } from "../schema/files";
import { secretReader } from "./secret-input";

const MAINTENANCE = `Maintenance commands (not operations):
  db:setup        create the tables and follow every change file
  db:migrate      follow the change files this database has not (run it on deploy)
  deliveries:run  send the webhook retries that are due
  trash:purge     delete what the trash has kept for 30 days, and the files nothing holds
  admin:reset-password [--email address]
                  set the admin's password and sign every browser out`;

/**
 * `monti <command>`: the maintenance commands, and every operation as a command (`monti help` lists them). `config` is `monti.config.ts`, loaded by
 * the bin; `root` is the site folder.
 */
export async function main(config: MontiConfig, root: string, argv: string[]): Promise<number> {
	const monti = openMonti(config, root);
	// A secret comes on standard input, typed at a prompt or piped in, never as an argument; its prompt goes to standard error.
	const secret = secretReader(process.stdin, process.stderr);
	const io = { out: (line: string) => console.log(line), err: (line: string) => console.error(line), secret };
	try {
		const [command] = argv;
		if (command === "db:setup" || command === "db:migrate") {
			await migrateToLatest(monti.db);
			const applied = await migrateContent(
				monti.db,
				config.schema,
				await readChangeFiles(path.join(root, "monti", "changes")),
				monti.site.kit,
			);
			io.out(applied.length > 0 ? `Applied ${applied.join(", ")}.` : "The database is up to date.");
			return 0;
		}
		if (command === "admin:reset-password") {
			const email = argv.indexOf("--email") > 0 ? argv[argv.indexOf("--email") + 1] : undefined;
			const password = await secret("New password");
			// Typed, it is typed twice; piped in, there is nobody to ask again.
			const again = process.stdin.isTTY ? await secret("Again") : password;
			if (password !== again) {
				io.err("The two passwords differ.");
				return 1;
			}
			io.out(`Password set for ${await resetAdminPassword(monti.db, password, email)}. Every browser is signed out.`);
			return 0;
		}
		if (command === "deliveries:run") {
			await monti.deliveries.sendDue();
			return 0;
		}
		if (command === "trash:purge") {
			const { purged, files } = await monti.trash.purgeDue();
			io.out(`Deleted ${purged} from the trash and ${files} files from the storage.`);
			return 0;
		}
		if (!command || command === "help") io.out(`${MAINTENANCE}\n\nOperations:`);
		return await runCli(monti, argv, io);
	} finally {
		await monti.db.destroy();
	}
}
