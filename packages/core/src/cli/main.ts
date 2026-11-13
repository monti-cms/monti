import path from "node:path";
import { resetAdminPassword } from "../auth/reset";
import { type MontiConfig, openMonti } from "../config";
import { restoreFrom, restoreProblem, writeBackup } from "../data/files";
import { migrateToLatest } from "../db/migrations";
import { runCli } from "../entry/cli";
import { migrateContent } from "../schema/apply";
import { readChangeFiles } from "../schema/files";
import { secretReader } from "./secret-input";

export { doctor } from "./doctor/command";
export { storageCors } from "./doctor/run";
export { loadEnvFiles, takeEnvFile } from "./env-files";
export { init } from "./init/command";
export { configFileOf } from "./site";

const MAINTENANCE = `Maintenance commands (not operations):
  db:setup        create the tables and follow every change file
  db:migrate      follow the change files this database has not (run it on deploy)
  deliveries:run  send the webhook retries that are due
  trash:purge     delete what the trash has kept for 30 days, and the files nothing holds
  backup [--media] [--out file.zip]
                  write the site's backup to a file; --media puts the media files in too
  restore file.zip
                  restore a backup into an empty database, as it was; with any problem nothing is written
  admin:reset-password [--email address]
                  set the admin's password and sign every browser out
  init [-y] [--admin-path /admin] [--locale en] [--login password|github] [--storage local|s3|none] [--dry-run]
                  add Monti to this Next.js site: writes the files it lacks, and says what is left
  doctor [--json] [--origin address]
                  check the site's set-up: its files, its environment, the database, the storage`;

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
				monti.site.fieldSets,
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
			// What only the running site can send (the Next adapter's cache refresh has no Next here) is left for it, untried: the admin's next visit
			// sends it. A try from here would only write "failed" over a delivery that has not failed.
			const { sent, failed, left } = await monti.deliveries.sendDue({ leaveUnknown: true });
			io.out(
				`Sent ${sent}, ${failed} failed.${left > 0 ? ` ${left} are the running site's to send: open the admin, or send them again from the activity log.` : ""}`,
			);
			return 0;
		}
		if (command === "trash:purge") {
			const { purged, files } = await monti.trash.purgeDue();
			await monti.cleanUp();
			io.out(`Deleted ${purged} from the trash and ${files} files from the storage.`);
			return 0;
		}
		if (command === "backup") {
			// The same file the tools' "backup" makes, written by the server: `--media` puts the files in too.
			const out = argv.indexOf("--out") > 0 ? argv[argv.indexOf("--out") + 1] : undefined;
			const file = path.resolve(root, out ?? `monti-backup-${new Date().toISOString().slice(0, 10)}.zip`);
			const made = await writeBackup(monti, file, { media: argv.includes("--media") });
			io.out(`Wrote ${made.entries} entries and ${made.files} media files to ${file}.`);
			return 0;
		}
		if (command === "restore") {
			const file = argv[1];
			if (!file || file.startsWith("--")) {
				io.err("Name the backup file: monti restore monti-backup-2026-11-05.zip");
				return 1;
			}
			const answer = await restoreFrom(monti, path.resolve(root, file));
			if ("problems" in answer) {
				io.err(
					`Nothing was written. ${answer.problems.length === 1 ? "1 problem" : `${answer.problems.length} problems`}:`,
				);
				for (const problem of answer.problems) io.err(`  ${restoreProblem(problem)}`);
				return 1;
			}
			const { entries, folders, media, files, templates } = answer.restored;
			io.out(
				`Restored ${entries} entries, ${folders} folders, ${media} media records (${files} files) and ${templates} templates.`,
			);
			return 0;
		}
		if (!command || command === "help") io.out(`${MAINTENANCE}\n\nOperations:`);
		return await runCli(monti, argv, io);
	} finally {
		await monti.db.destroy();
	}
}
