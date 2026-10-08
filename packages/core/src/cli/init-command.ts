import { parseArgs } from "node:util";
import { formatInitReport, type InitHost, initProject } from "./init";
import type { PackageManager } from "./init-detect";
import { createClackPrompter, InitCancelled, type Prompter } from "./init-prompts";

/** The `monti init` command line: flags in, the report out. Kept apart from `index.ts` so the flag list and the prompt wiring sit with the command. */

export interface InitCommandIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
}

export interface InitCommandExtras {
	/** A person is at the terminal. Default: stdin and stdout are terminals. */
	readonly interactive?: boolean;
	/** Replaces the prompt library (tests). */
	readonly prompter?: Prompter;
	readonly host?: Partial<InitHost>;
}

const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

const options = {
	yes: { type: "boolean", short: "y" },
	json: { type: "boolean" },
	"dry-run": { type: "boolean" },
	database: { type: "string" },
	"database-schema": { type: "string" },
	"admin-github-id": { type: "string" },
	"site-url": { type: "string" },
	locales: { type: "string" },
	locale: { type: "string" },
	"time-zone": { type: "string" },
	storage: { type: "string" },
	extras: { type: "string" },
	blocks: { type: "string" },
	"admin-path": { type: "string" },
	"blog-theme": { type: "boolean" },
	"no-blog-theme": { type: "boolean" },
	overwrite: { type: "boolean" },
	"no-install": { type: "boolean" },
	"no-migrate": { type: "boolean" },
	"no-docker-start": { type: "boolean" },
	"package-manager": { type: "string" },
	resume: { type: "boolean" },
} as const;

/** Runs `monti init <argv>` and returns the exit code: 0 done, 1 an error or a step that failed, 130 cancelled. */
export async function runInitCommand(
	argv: readonly string[],
	io: InitCommandIo,
	extras: InitCommandExtras = {},
): Promise<number> {
	const json = argv.includes("--json");
	try {
		const { values } = parseArgs({ args: [...argv], options });
		const manager = values["package-manager"];
		if (manager !== undefined && !(PACKAGE_MANAGERS as readonly string[]).includes(manager)) {
			throw new Error(`--package-manager "${manager}" must be one of ${PACKAGE_MANAGERS.join(", ")}`);
		}
		if (values["blog-theme"] && values["no-blog-theme"]) {
			throw new Error("--blog-theme and --no-blog-theme cannot both be given");
		}
		// Prompts only when a person is at the terminal and did not ask for none.
		const interactive =
			(extras.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)) && !values.yes && !json;
		const prompter = interactive ? (extras.prompter ?? (await createClackPrompter())) : undefined;
		const report = await initProject({
			cwd: io.cwd,
			prompter,
			dryRun: values["dry-run"],
			overwrite: values.overwrite,
			install: values["no-install"] ? false : undefined,
			migrate: values["no-migrate"] ? false : undefined,
			dockerStart: values["no-docker-start"] ? false : undefined,
			resume: values.resume,
			packageManager: manager as PackageManager | undefined,
			database: values.database,
			databaseSchema: values["database-schema"],
			adminGithubId: values["admin-github-id"],
			siteUrl: values["site-url"],
			locales: values.locales ?? values.locale,
			timeZone: values["time-zone"],
			storage: values.storage,
			extras: values.extras,
			blocks: values.blocks,
			adminPath: values["admin-path"],
			blogTheme: values["blog-theme"] ? true : values["no-blog-theme"] ? false : undefined,
			log: json ? undefined : io.log,
			host: extras.host,
		});
		if (json) {
			io.log(JSON.stringify(report, null, 2));
		} else {
			io.log(formatInitReport(report));
			prompter?.outro(report.ok ? "Done." : "Done, with a problem (see above).");
		}
		return report.ok ? 0 : 1;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (json) io.log(JSON.stringify({ ok: false, error: message }, null, 2));
		else io.error(message);
		return error instanceof InitCancelled ? 130 : 1;
	}
}
