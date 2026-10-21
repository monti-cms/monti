import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { chosenBlocks } from "./block-choices";
import type { DoctorReport } from "./doctor";
import type { InitAnswers } from "./init-answers";
import type { DetectedApp, PackageManager } from "./init-detect";
import { detectSystemTimeZone } from "./init-prompts";
import type { InitHost, InitReport, InitStep, InstallCommand } from "./init-types";
import type { Prompter } from "./prompt";

/** The install stage of `monti init`: which packages, the package manager commands, and running the install. */

/**
 * The libraries the admin shares with the app, which `@monti-cms/admin` (and the AI plugin and the blocks) declare as peer dependencies and so are not installed
 * with it. They must stay peers: React Query, next-themes, sonner, Tiptap and the lucide icons keep state in a module-level context or schema, so the admin, the plugins and
 * the app's own admin pages have to load one copy. `monti init` installs them with the Monti packages.
 */
export const ADMIN_PEER_PACKAGES = [
	"next-themes",
	"@tanstack/react-query",
	"sonner",
	"@tiptap/core",
	"@tiptap/pm",
	"@tiptap/react",
	"lucide-react",
] as const;

const unique = <T>(values: readonly T[]) => [...new Set(values)];

/** The npm packages the answers need, besides what the app already lists. */
export function packagesFor(answers: InitAnswers): string[] {
	const blocks = chosenBlocks(answers.blocks);
	return unique([
		"@monti-cms/core",
		"@monti-cms/auth",
		"@monti-cms/admin",
		"@monti-cms/nextjs",
		"@monti-cms/mdx",
		...ADMIN_PEER_PACKAGES,
		...(blocks.length > 0 ? ["@monti-cms/blocks"] : []),
		...blocks.flatMap((block) => (block.needs ? [block.needs] : [])),
		...(answers.directiveSyntax ? ["@monti-cms/syntax-directive"] : []),
		...(answers.ai ? ["@monti-cms/ai"] : []),
		...(answers.gitSync ? ["@monti-cms/git-sync"] : []),
		...(answers.storage === "s3" ? ["@monti-cms/storage-s3"] : []),
	]);
}

/** Runs `monti <args>` of the app's own install in a child process (its own module cache and database connection), and collects the output. */
function runMonti(cwd: string, args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }> {
	const bin = path.join(cwd, "node_modules", "@monti-cms", "core", "bin", "monti.mjs");
	return new Promise((resolve, reject) => {
		if (!existsSync(bin)) {
			reject(new Error("@monti-cms/core is not installed in this app yet"));
			return;
		}
		execFile(
			process.execPath,
			[bin, ...args],
			{ cwd, maxBuffer: 16 * 1024 * 1024, timeout: 120_000 },
			(error, stdout, stderr) => {
				if (error && typeof error.code !== "number") reject(error);
				else resolve({ code: error ? (error.code as number) : 0, stdout: String(stdout), stderr: String(stderr) });
			},
		);
	});
}

/** The last lines of what a command printed, which is where its reason is. */
const tail = (text: string, lines = 4): string => text.trim().split("\n").slice(-lines).join("\n");

/** The real host: spawns the package manager and the `monti` command of the app. */
export const defaultInitHost: InitHost = {
	systemTimeZone: detectSystemTimeZone,
	environment: () => process.env,
	setupDatabase: async (cwd) => {
		const result = await runMonti(cwd, ["db:setup"]);
		if (result.code !== 0) throw new Error(tail(result.stderr || result.stdout) || "db:setup failed");
	},
	runDoctor: async (cwd) => {
		const result = await runMonti(cwd, ["doctor", "--json"]);
		try {
			return JSON.parse(result.stdout) as DoctorReport;
		} catch {
			throw new Error(tail(result.stderr || result.stdout) || "doctor printed nothing");
		}
	},
	install: (command) => {
		const result = spawnSync(command.command, [...command.args], { cwd: command.cwd, stdio: "inherit" });
		if (result.error || result.status !== 0) {
			throw new Error(
				`\`${command.command} ${command.args.join(" ")}\` failed${result.error ? `: ${result.error.message}` : ""}`,
			);
		}
	},
};

/** The package manager's command for `monti <args>` and for a package script. */
export const exec = (manager: PackageManager, args: string): string =>
	manager === "npm"
		? `npx monti ${args}`
		: manager === "pnpm"
			? `pnpm exec monti ${args}`
			: manager === "yarn"
				? `yarn monti ${args}`
				: `bunx monti ${args}`;
export const script = (manager: PackageManager, name: string): string =>
	manager === "npm" || manager === "bun" ? `${manager} run ${name}` : `${manager} ${name}`;
export const addCommand = (
	manager: PackageManager,
	packages: readonly string[],
	cwd: string,
	dev = false,
): InstallCommand => ({
	command: manager,
	args: [manager === "npm" ? "install" : "add", ...(dev ? ["-D"] : []), ...packages],
	cwd,
});
/** One argument as a shell word: left as it is when it is plain, else in single quotes (the `&` and `#` of a GitHub spec would end the command or start a comment). */
const shellWord = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`);
export const commandText = (command: InstallCommand) => [command.command, ...command.args.map(shellWord)].join(" ");

/** A git address that points at a folder of a repository (`github:owner/repo#ref&path:/core`), as Monti's release bundles are installed. */
const CORE_FOLDER_SPEC = /^(?:github:|git\+|git:|git@|ssh:|https?:\/\/).*(?:^|[#&])path:\/core(?=&|$)/;

/**
 * The install specs of the Monti packages: while Monti is not on npm, `@monti-cms/core` is a GitHub address with `path:/core`, and each sibling is that address with its own folder.
 * With any other spec (or none) the names stay bare. Packages that are not Monti's stay bare.
 */
export function installSpecs(packages: readonly string[], coreSpec: string | undefined): string[] {
	if (coreSpec === undefined || !CORE_FOLDER_SPEC.test(coreSpec)) return [...packages];
	return packages.map((name) => {
		const folder = name.startsWith("@monti-cms/") ? name.slice("@monti-cms/".length) : undefined;
		return folder ? `${name}@${coreSpec.replace(/(^|[#&])path:\/core(?=&|$)/, `$1path:/${folder}`)}` : name;
	});
}

/**
 * Installs the packages and records it in `report.steps`. A failure is recorded as failed (and `report.ok` turns false); running `monti init` again installs
 * what is still missing. Returns whether the packages are in place. Nothing here throws.
 */
export async function runInstallStep(input: {
	readonly cwd: string;
	readonly host: InitHost;
	readonly log: (message: string) => void;
	readonly dryRun: boolean;
	readonly manager: PackageManager;
	readonly report: InitReport;
	/** Neither `--no-install` nor a "no" to the confirmation. */
	readonly installing: boolean;
	/** The person answered no to the confirmation. */
	readonly declined: boolean;
	readonly packages: readonly string[];
	/** What is passed to the package manager for each of `packages`. */
	readonly specs: readonly string[];
}): Promise<boolean> {
	const { cwd, host, log, dryRun, manager, report } = input;
	if (input.packages.length === 0) return true;
	report.installed = [...input.packages];
	const record = (status: InitStep["status"], detail: string) =>
		report.steps.push({ name: "Install packages", status, detail });
	if (!input.installing) {
		record("skipped", input.declined ? "you answered no" : "--no-install");
		return false;
	}
	if (dryRun) {
		record("planned", commandText(addCommand(manager, input.specs, cwd)));
		return false;
	}
	log(`Installing ${input.packages.length} packages with ${manager} ...`);
	try {
		await host.install(addCommand(manager, input.specs, cwd));
		record("done", `${input.packages.length} packages with ${manager}`);
		return true;
	} catch (error) {
		report.ok = false;
		record("failed", error instanceof Error ? error.message : String(error));
		return false;
	}
}

/** What gets installed, and whether it will be. */
export interface InstallPlan {
	/** The Monti packages (and the libraries they share with the app) the app does not list yet. */
	readonly missing: readonly string[];
	/** What is passed to the package manager for each of `missing`. */
	readonly specs: readonly string[];
	readonly command: InstallCommand;
	/** Neither `--no-install` nor a "no" to the confirmation. */
	readonly installing: boolean;
	/** The person answered no to the confirmation. */
	readonly declined: boolean;
}

/** Works out what is missing and whether the person agrees to run the install (default yes). `--yes`, `--json` and a missing terminal accept without asking. */
export async function planInstall(input: {
	readonly cwd: string;
	readonly app: Pick<DetectedApp, "dependencies" | "coreSpec">;
	readonly answers: InitAnswers;
	readonly manager: PackageManager;
	/** `false` for `--no-install`. */
	readonly install: boolean | undefined;
	readonly dryRun: boolean;
	readonly prompter?: Prompter;
}): Promise<InstallPlan> {
	const missing = packagesFor(input.answers).filter((name) => !input.app.dependencies.has(name));
	const specs = installSpecs(missing, input.app.coreSpec);
	const command = addCommand(input.manager, specs, input.cwd);
	let installing = input.install !== false;
	let declined = false;
	if (installing && missing.length > 0 && input.prompter && !input.dryRun) {
		installing = await input.prompter.confirm({
			message: `Install the ${missing.length} Monti packages with \`${commandText(command)}\`?`,
			initial: true,
		});
		declined = !installing;
	}
	return { missing, specs, command, installing, declined };
}
