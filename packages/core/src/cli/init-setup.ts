import type { DoctorResult } from "./doctor";
import type { InitAnswers } from "./init-answers";
import type { PackageManager } from "./init-detect";
import { databaseUrl, ENV_LOCAL, prepareEnvFile } from "./init-env";
import { exec } from "./init-install";
import type { InitHost, InitReport, InitStep } from "./init-types";
import type { Prompter, TaskOutcome } from "./prompt";

/**
 * The machine steps of `monti init`, run after the files are written and the packages are installed: `.env.local` with a `MONTI_SECRET`, the database setup, and
 * the doctor. Each is one progress line. None of them aborts init: a step that does not work is recorded, and its human version goes into the list of what is left.
 */

export interface SetupInput {
	readonly cwd: string;
	readonly host: InitHost;
	readonly env: Record<string, string | undefined>;
	readonly prompter?: Prompter;
	readonly log: (message: string) => void;
	readonly report: InitReport;
	readonly manager: PackageManager;
	readonly answers: InitAnswers;
	/** `@monti-cms/core` is in the app (it was, or the install just worked), so `db:setup` and `doctor` can run. */
	readonly packagesReady: boolean;
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The by-hand version of the `.env.local` step. */
const ENV_BY_HAND = [
	"Create .env.local from the example and fill it in (.env.example says what each value is and where to get it):",
	"cp .env.example .env.local",
	"MONTI_SECRET is a long random value. Generate one with:",
	"openssl rand -base64 32",
	"or, without openssl:",
	`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
].join("\n");

/** The by-hand steps of the setup, for a run that did not do them (`--no-setup`, a no, a dry run). */
export function manualSetupSteps(manager: PackageManager): string[] {
	return [
		ENV_BY_HAND,
		`Create Monti's tables in your database (once): ${exec(manager, "db:setup")}`,
		`Check the setup: ${exec(manager, "doctor")}\nIt lists every check as ok, warn or fail, and \`monti doctor\` will tell you if any of the steps above is missing.`,
	];
}

/** One failed check, in the words of the list of what is left. */
const failureLine = (check: DoctorResult): string =>
	`${check.id}: ${check.message.split("\n")[0]}${check.fix ? `\n    fix: ${check.fix.replaceAll("\n", " ")}` : ""}`;

/** Runs the three steps and returns what is left of them for a person to do (empty when they all worked). */
export async function runSetupSteps(input: SetupInput): Promise<string[]> {
	const { cwd, host, env, prompter, log, report, manager } = input;
	const leftover: string[] = [];

	// A step is one progress line: a spinner at the terminal, a plain line without one.
	const step = async (name: string, title: string, work: () => Promise<TaskOutcome>): Promise<TaskOutcome> => {
		let outcome: TaskOutcome;
		const safe = async (): Promise<TaskOutcome> => {
			try {
				return await work();
			} catch (error) {
				return { status: "failed", message: reasonOf(error) };
			}
		};
		if (prompter) outcome = await prompter.task(title, safe);
		else {
			outcome = await safe();
			log(`${outcome.status === "failed" ? "FAILED " : ""}${outcome.message}`);
		}
		report.steps.push({ name, status: outcome.status, detail: outcome.message } satisfies InitStep);
		if (outcome.status === "failed") report.ok = false;
		return outcome;
	};

	// 1. .env.local and the secret
	await step("Set up .env.local", "Setting up .env.local", async () => {
		try {
			const result = prepareEnvFile(cwd);
			if (result.action === "missing-example") {
				leftover.push(ENV_BY_HAND);
				return { status: "skipped", message: `No .env.example to copy, so no ${ENV_LOCAL} was made` };
			}
			if (result.action === "created") {
				return { status: "done", message: `Created ${ENV_LOCAL} from .env.example, with a new MONTI_SECRET` };
			}
			return {
				status: "done",
				message: {
					kept: `Kept ${ENV_LOCAL} as it is (MONTI_SECRET is already set)`,
					filled: `Kept ${ENV_LOCAL}; filled its empty MONTI_SECRET`,
					added: `Kept ${ENV_LOCAL}; added the missing MONTI_SECRET`,
				}[result.secret],
			};
		} catch (error) {
			leftover.push(ENV_BY_HAND);
			return { status: "failed", message: `Could not write ${ENV_LOCAL}: ${reasonOf(error)}` };
		}
	});

	// 2. The database
	const dbCommand = exec(manager, "db:setup");
	const url = databaseUrl(cwd, env);
	let databaseUnset = false;
	await step("Set up the database", "Creating Monti's tables", async () => {
		if (!input.packagesReady) {
			leftover.push(
				`Once the packages are installed and DATABASE_URL is in ${ENV_LOCAL}, create Monti's tables (once): ${dbCommand}`,
			);
			return {
				status: "skipped",
				message: `Skipped the database: the packages are not installed yet. Later: ${dbCommand}`,
			};
		}
		if (!url) {
			databaseUnset = true;
			leftover.push(
				`Put your Postgres URL in DATABASE_URL in ${ENV_LOCAL} (.env.example says where to get it), then create Monti's tables (once): ${dbCommand}`,
			);
			return {
				status: "skipped",
				message: `Skipped the database: no DATABASE_URL yet. Once it is in ${ENV_LOCAL}: ${dbCommand}`,
			};
		}
		try {
			await host.setupDatabase(cwd);
			return { status: "done", message: "Monti's tables are in the database" };
		} catch (error) {
			leftover.push(
				`Create Monti's tables (the setup failed: ${reasonOf(error)}). Fix that, then run once: ${dbCommand}`,
			);
			return { status: "failed", message: `The database setup failed: ${reasonOf(error)}` };
		}
	});

	// 3. The doctor
	const doctorCommand = exec(manager, "doctor");
	await step("Check the setup", "Checking the setup", async () => {
		if (!input.packagesReady) {
			leftover.push(`Check the setup once the packages are installed: ${doctorCommand}`);
			return {
				status: "skipped",
				message: `Skipped the check: the packages are not installed yet. Later: ${doctorCommand}`,
			};
		}
		try {
			const result = await host.runDoctor(cwd);
			const { ok, warn, fail } = result.summary;
			// What another line already says is not repeated: no database yet, or the GitHub login values the OAuth app step lists.
			const failures = result.checks.filter(
				(check) =>
					check.status === "fail" &&
					!(databaseUnset && check.group === "database") &&
					!(input.answers.login === "github" && check.group === "auth"),
			);
			if (failures.length > 0) {
				leftover.push(
					`Fix what \`${doctorCommand}\` found:\n${failures.map((check) => `  ${failureLine(check)}`).join("\n")}`,
				);
			}
			const counts = [
				`${ok} ok`,
				...(warn > 0 ? [plural(warn, "warning", "warnings")] : []),
				...(fail > 0 ? [`${fail} to fix`] : []),
			];
			return { status: "done", message: `Checked the setup: ${counts.join(", ")}` };
		} catch (error) {
			leftover.push(`Check the setup: ${doctorCommand}`);
			return { status: "failed", message: `The check could not run: ${reasonOf(error)}` };
		}
	});

	return leftover;
}
