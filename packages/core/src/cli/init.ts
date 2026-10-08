import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { parseEnv } from "node:util";
import { parseSchemaFile } from "../schema-file/format";
import { addComponents, type InstallCommand } from "./add";
import { unifiedDiff } from "./diff";
import { addSuppressHydrationWarning, findRootLayout, hasSuppressHydrationWarning } from "./first-run";
import { detectApp, type PackageManager } from "./init-detect";
import { addEnvToGitignore, addResolveJsonModule, addStateToGitignore, allowEsbuildBuild } from "./init-edits";
import { collectAnswers, detectedLocales, type InitAnswerFlags, InitCancelled, type Prompter } from "./init-prompts";
import { clearInitState, readInitState, STEP_ORDER, type StepId, type StepState, writeInitState } from "./init-state";
import { migrate } from "./migrate";
import { INIT_PROXY_TEMPLATE, PROXY_FILES } from "./proxy-template";
import { SCHEMA_TYPES_FILE, schemaTypesText } from "./schema-types";
import {
	adminLayoutTemplate,
	adminPageTemplate,
	apiRouteTemplate,
	configTemplate,
	dockerComposeTemplate,
	dockerDatabaseUrl,
	ENV_LOCAL_HEADER,
	envExampleTemplate,
	githubCallbackUrl,
	type InitAnswers,
	nextConfigTemplate,
	packagesFor,
	pathFor,
	schemaTemplate,
	starterCollections,
} from "./templates";

/**
 * `monti init`: adds Monti to an existing Next app. It reads the app, asks (or takes flags, or defaults), then writes explicit files, installs the packages, starts
 * a local database if asked, runs the migrations when the database is reachable, and ends with a plain summary of what is done and what is left.
 *
 * Safety: every write goes through {@link ProjectWriter}, which refuses a path outside the project. An existing file is never overwritten unless the person says yes
 * (or passes `overwrite`). Nothing is written until every question is answered, so cancelling leaves the project as it was.
 */

/** The things `monti init` reaches out of the process for. Tests replace them; the defaults are the real thing. */
export interface InitHost {
	/** Runs a command and returns whether it exited with 0. */
	run(command: string, args: readonly string[], cwd: string): boolean;
	/** Whether `docker compose` can be used. */
	dockerAvailable(): boolean;
	/** The first free TCP port from `start`. */
	freePort(start: number): Promise<number>;
	/** Whether a Postgres answers at the URL, waiting up to `waitMs` for it to come up. */
	databaseReachable(url: string, waitMs: number): Promise<boolean>;
	generateSecret(): string;
	/** Installs packages with the package manager. Throws when it fails. */
	install(command: InstallCommand): void | Promise<void>;
	/** `monti migrate` for the app. */
	migrate(cwd: string): Promise<boolean>;
	/** The version of pnpm the app would use (`pnpm --version`), or `undefined` when it cannot be run. */
	pnpmVersion(cwd: string): string | undefined;
}

export interface InitOptions extends InitAnswerFlags {
	/** Next app folder (where `package.json` is). */
	readonly cwd: string;
	/** A person is at the terminal: ask the questions that have no flag. Without it nothing is asked. */
	readonly prompter?: Prompter;
	/** Work out and report everything, write and run nothing. */
	readonly dryRun?: boolean;
	/** Replace existing files that differ, without asking. */
	readonly overwrite?: boolean;
	/** `false` (`--no-install`): do not install packages (and so do not migrate or add the theme). */
	readonly install?: boolean;
	/** `false` (`--no-migrate`): do not run `monti migrate`. */
	readonly migrate?: boolean;
	/** `false` (`--no-docker-start`): write docker-compose.yml but do not start it. */
	readonly dockerStart?: boolean;
	/** `--resume`: do not ask or write files; run again only the steps the last run did not complete (from `.monti/init.json`). */
	readonly resume?: boolean;
	/** Override the detected package manager. */
	readonly packageManager?: PackageManager;
	/** Progress lines while the work runs. */
	readonly log?: (message: string) => void;
	readonly host?: Partial<InitHost>;
	/** The environment to look for `DATABASE_URL` in. Default: `process.env`. */
	readonly env?: Record<string, string | undefined>;
}

export interface InitStep {
	readonly id?: StepId;
	readonly name: string;
	readonly status: "done" | "skipped" | "failed" | "planned";
	readonly detail?: string;
	/** The step did not complete and `monti init --resume` runs it again (it failed, or something it needs is not there yet). */
	readonly retry?: boolean;
}

export interface InitReport {
	/** `false` when a step (install, database, migrate) failed. The files are still written. */
	ok: boolean;
	readonly dryRun: boolean;
	readonly app: {
		readonly name?: string;
		readonly next?: string;
		readonly src: boolean;
		readonly packageManager: PackageManager;
		readonly typescript: boolean;
		readonly tailwind: { readonly installed: boolean; readonly typography: boolean };
		readonly contentFolders: readonly { readonly dir: string; readonly files: number }[];
	};
	/** What was decided. The database URL has its password hidden. */
	readonly answers: InitAnswers;
	/** Newly created files (relative to `cwd`). */
	readonly created: string[];
	/** Files that already existed and were left as they are. */
	skipped: string[];
	/** Files changed: `next.config.ts`, `.env.local` (values added). */
	readonly updated: string[];
	/** Existing files that were replaced (only on a yes or `overwrite`). */
	readonly overwritten: string[];
	/** Packages installed (or to install, on a dry run). */
	installed: string[];
	readonly steps: InitStep[];
	/** The change to each updated file, as a diff. */
	readonly diffs: { readonly file: string; readonly diff: string }[];
	/** Things worth knowing that need no action. */
	readonly notes: string[];
	/** What is left to do, in order, with exact values. */
	readonly next: string[];
	/** When a step failed: the exact commands that finish the job, in the order to run them. Empty otherwise. */
	recovery: string[];
	/** The command that runs only the steps that did not finish (the progress is saved), when a step failed. */
	resumeCommand?: string;
	/** The report is of a `--resume` run. */
	readonly resumed?: boolean;
}

/** An error after files were already written. `written` lists them, so the message can say what is on disk. */
export class InitError extends Error {
	constructor(
		message: string,
		readonly written: readonly string[],
	) {
		super(
			written.length === 0
				? `${message}\n\nNothing was written.`
				: `${message}\n\nThese files were written before it failed (nothing was undone):\n${written.map((file) => `  - ${file}`).join("\n")}\nRun \`monti init\` again to continue: existing files are kept.`,
		);
		this.name = "InitError";
	}
}

const posix = (file: string) => file.split(path.sep).join("/");
const dotted = (file: string) => (file.startsWith(".") ? file : `./${file}`);

/** Writes only inside the project folder: an absolute path, a `..` path, or a path that goes through a symlink out of the folder is refused. */
export class ProjectWriter {
	private readonly root: string;
	readonly written: string[] = [];

	constructor(cwd: string) {
		this.root = realpathSync(cwd);
	}

	/** The absolute path of `file` if it is inside the project, else throws. */
	resolve(file: string): string {
		if (path.isAbsolute(file) || file.split(/[\\/]/).includes("..")) {
			throw new Error(`Refusing to write ${file}: it is outside the project`);
		}
		const target = path.resolve(this.root, file);
		const inside = (candidate: string) => candidate === this.root || candidate.startsWith(this.root + path.sep);
		if (!inside(target)) throw new Error(`Refusing to write ${file}: it is outside the project`);
		// A symlinked folder on the way must not lead out either: check the deepest folder that exists.
		let probe = path.dirname(target);
		while (!existsSync(probe) && probe !== this.root) probe = path.dirname(probe);
		if (!inside(realpathSync(probe)))
			throw new Error(`Refusing to write ${file}: a folder on its path leads outside the project`);
		return target;
	}

	exists(file: string): boolean {
		return existsSync(this.resolve(file));
	}

	read(file: string): string {
		return readFileSync(this.resolve(file), "utf8");
	}

	write(file: string, content: string): void {
		const target = this.resolve(file);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, content);
		this.written.push(posix(file));
	}
}

/** The real host: spawns the package manager and Docker, probes the database port. */
export const defaultInitHost: InitHost = {
	run: (command, args, cwd) => {
		const result = spawnSync(command, [...args], { cwd, stdio: "ignore" });
		return !result.error && result.status === 0;
	},
	dockerAvailable: () => {
		const result = spawnSync("docker", ["info"], { stdio: "ignore", timeout: 8000 });
		return !result.error && result.status === 0;
	},
	freePort: async (start) => {
		for (let port = start; port < start + 20; port++) {
			const free = await new Promise<boolean>((resolve) => {
				const server = net.createServer();
				server.once("error", () => resolve(false));
				server.once("listening", () => server.close(() => resolve(true)));
				server.listen(port, "127.0.0.1");
			});
			if (free) return port;
		}
		return start;
	},
	// A TCP connect to the host and port of the URL (the Postgres driver stays in the store adapter). `monti migrate` is what really logs in.
	databaseReachable: async (url, waitMs) => {
		let target: URL;
		try {
			target = new URL(url);
		} catch {
			return false;
		}
		// A socket path or no host: nothing to probe here, let `monti migrate` try.
		if (!target.hostname) return true;
		const port = Number(target.port || 5432);
		const deadline = Date.now() + waitMs;
		for (;;) {
			const open = await new Promise<boolean>((resolve) => {
				const socket = net.connect({ host: target.hostname, port, timeout: 3000 });
				socket.once("connect", () => socket.end(() => resolve(true)));
				socket.once("timeout", () => socket.destroy(new Error("timeout")));
				socket.once("error", () => resolve(false));
			});
			if (open) return true;
			if (Date.now() >= deadline) return false;
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	},
	generateSecret: () => randomBytes(32).toString("base64"),
	install: (command) => {
		const result = spawnSync(command.command, [...command.args], { cwd: command.cwd, stdio: "inherit" });
		if (result.error || result.status !== 0) {
			throw new Error(
				`\`${command.command} ${command.args.join(" ")}\` failed${result.error ? `: ${result.error.message}` : ""}`,
			);
		}
	},
	migrate: (cwd) => migrate({ cwd, log: () => undefined }),
	pnpmVersion: (cwd) => {
		const result = spawnSync("pnpm", ["--version"], { cwd, encoding: "utf8", timeout: 15000 });
		return result.error || result.status !== 0 ? undefined : result.stdout.trim() || undefined;
	},
};

/** The package manager's command for `monti <args>` and for a package script. */
const exec = (manager: PackageManager, args: string): string =>
	manager === "npm"
		? `npx monti ${args}`
		: manager === "pnpm"
			? `pnpm exec monti ${args}`
			: manager === "yarn"
				? `yarn monti ${args}`
				: `bunx monti ${args}`;
const script = (manager: PackageManager, name: string): string =>
	manager === "npm" || manager === "bun" ? `${manager} run ${name}` : `${manager} ${name}`;
const addCommand = (
	manager: PackageManager,
	packages: readonly string[],
	cwd: string,
	dev = false,
): InstallCommand => ({
	command: manager,
	args: [manager === "npm" ? "install" : "add", ...(dev ? ["-D"] : []), ...packages],
	cwd,
});
const commandText = (command: InstallCommand) => `${command.command} ${command.args.join(" ")}`;

/** The URL with the password hidden, for the report. */
const maskUrl = (url: string): string => url.replace(/(\/\/[^:/@\s]+:)[^@\s]*@/, "$1***@");

function parseEnvSafe(text: string): Record<string, string | undefined> {
	try {
		return parseEnv(text);
	} catch {
		return {};
	}
}

/** Names set in an env file's text. */
function envKeys(text: string): Set<string> {
	try {
		return new Set(Object.keys(parseEnv(text)));
	} catch {
		return new Set();
	}
}

/**
 * The next config with `withCms` added, or `undefined` when its shape is not the default one (a single `export default nextConfig;`). Used both to show the diff
 * and to write it.
 */
function mergeWithCms(text: string): string | undefined {
	if (text.includes("withCms")) return text;
	const exportLine = /^export default nextConfig;?[ \t]*$/m;
	const exports = text.match(new RegExp(exportLine.source, "gm")) ?? [];
	if (exports.length !== 1) return undefined;
	return `import { withCms } from "@monti-cms/nextjs/config";\n${text.replace(exportLine, "export default withCms(nextConfig);")}`;
}

/** Runs the whole of `monti init` in `options.cwd`. Throws {@link InitCancelled} when the person cancels, {@link InitError} when a write fails. */
export async function initProject(options: InitOptions): Promise<InitReport> {
	if (options.resume) return resumeInit(options);
	const { cwd } = options;
	const host: InitHost = { ...defaultInitHost, ...options.host };
	const log = options.log ?? (() => undefined);
	const dryRun = options.dryRun === true;
	const prompter = options.prompter;

	const app = detectApp(cwd);
	if (!app.next) {
		throw new Error(
			"`next` is not in the dependencies of package.json. `monti init` adds Monti to an existing Next app (App Router); create one with `npx create-next-app@latest` first.",
		);
	}
	if (app.pagesRouterOnly) {
		throw new Error(
			`This app only has a pages/ folder. Monti needs the App Router: add an ${app.src ? "src/app" : "app"}/ folder (it can sit next to pages/), then run \`monti init\` again.`,
		);
	}
	const manager = options.packageManager ?? app.packageManager;

	prompter?.intro(`Add Monti to ${app.packageName ?? "this app"}`);
	const detectedLine = [
		`Next ${app.next.replace(/^[\^~]/, "")} (App Router${app.src ? ", src/" : ""})`,
		manager,
		app.typescript ? "TypeScript" : "no TypeScript",
		app.tailwind.installed
			? app.tailwind.typography
				? "Tailwind + typography"
				: "Tailwind, no typography plugin"
			: "no Tailwind",
	].join(" · ");
	prompter?.note(
		[
			detectedLine,
			...app.contentFolders.map(
				(folder) =>
					`Found ${folder.files} Markdown/MDX file${folder.files === 1 ? "" : "s"} in ${folder.dir}/${folder.locales ? ` (${folder.locales.map((locale) => locale.code).join(", ")})` : ""}`,
			),
		].join("\n"),
		"Detected",
	);

	const answers = await collectAnswers(app, options, prompter);
	const foundLocales = detectedLocales(app);

	// Which database URL goes to .env.local, and the docker port.
	const docker = answers.database.kind === "docker";
	const dockerPort = docker ? await host.freePort(5432) : 5432;
	const databaseUrl =
		answers.database.kind === "url" ? answers.database.url : docker ? dockerDatabaseUrl(dockerPort) : undefined;

	// Plan the files.
	const writer = new ProjectWriter(cwd);
	const root = app.src ? "src/" : "";
	const configFile = `${root}monti.config.ts`;
	const schemaFile = `${root}monti.schema.json`;
	const typesFile = `${root}${SCHEMA_TYPES_FILE}`;
	const adminDir = posix(path.join(app.appDir, ...answers.adminPath.split("/").filter(Boolean)));
	const pageFile = `${adminDir}/[[...path]]/page.tsx`;
	const layoutFile = `${adminDir}/layout.tsx`;
	const routeFile = `${app.appDir}/api/cms/[...path]/route.ts`;
	const configImport = (from: string) =>
		dotted(posix(path.relative(path.dirname(from), configFile.replace(/\.ts$/, ""))));

	const report: InitReport = {
		ok: true,
		dryRun,
		app: {
			name: app.packageName,
			next: app.next,
			src: app.src,
			packageManager: manager,
			typescript: app.typescript,
			tailwind: app.tailwind,
			contentFolders: app.contentFolders.map(({ dir, files }) => ({ dir, files })),
		},
		answers: {
			...answers,
			database:
				answers.database.kind === "url" ? { kind: "url", url: maskUrl(answers.database.url) } : answers.database,
		},
		created: [],
		skipped: [],
		updated: [],
		overwritten: [],
		installed: [],
		steps: [],
		diffs: [],
		notes: [],
		next: [],
		recovery: [],
	};

	if (foundLocales) {
		const where = foundLocales.from === "filename" ? "the file names" : "the folders";
		report.notes.push(
			options.locales === undefined && answers.locales.join(",") === foundLocales.codes.join(",")
				? `The site languages are ${answers.locales.join(", ")}, found in ${where} of ${foundLocales.dir}/. ${answers.locales[0]} is the default${foundLocales.codes.length > 1 ? " (its files have no pair)" : ""}; change "defaultLocale" and "locales" in the schema file if that is wrong.`
				: `${foundLocales.codes.join(", ")} found in ${where} of ${foundLocales.dir}/, but the site languages are ${answers.locales.join(", ")}. Files in a language the site does not have are skipped by \`monti import\` (with a warning).`,
		);
	}

	// Next's `cacheComponents` (on by default in the apps `create-next-app` 16.4 makes) validates every page for instant navigation in development; the admin opts out.
	const usesCacheComponents =
		app.nextConfig !== undefined && /\bcacheComponents\s*:\s*true\b/.test(writer.read(app.nextConfig));

	// Files to write when they do not exist yet.
	const planned: { file: string; content: string }[] = [];
	const keepConfig = app.existingConfig !== undefined || app.legacyConfig.length > 0;
	if (app.legacyConfig.length > 0 && app.existingConfig === undefined) {
		report.notes.push(
			`${app.legacyConfig.join(" and ")} from the earlier setup ${app.legacyConfig.length > 1 ? "are" : "is"} left alone, and no ${configFile} was created. They are one ${configFile} now: move them into it (see "Upgrading" in the core README).`,
		);
	}
	if (!keepConfig) {
		planned.push({ file: configFile, content: configTemplate(answers) });
		const folder = app.contentFolders[0];
		const schemaText = schemaTemplate(answers, {
			siteName: app.packageName,
			folder,
			link: dotted(
				posix(path.join(path.relative(path.dirname(schemaFile), "."), "node_modules/@monti-cms/core/schema.json")),
			),
		});
		planned.push({ file: schemaFile, content: schemaText });
		// The types are written from the schema (and this also checks the schema we generated is valid).
		const parsed = parseSchemaFile(JSON.parse(schemaText), schemaFile);
		planned.push({
			file: typesFile,
			content: schemaTypesText(parsed, posix(path.relative(path.dirname(typesFile), schemaFile))),
		});
		if (folder) {
			const keys = folder.keys.map((key) => key.name);
			report.notes.push(
				`The post collection follows the front matter of ${folder.dir}/ (${keys.length > 0 ? keys.slice(0, 8).join(", ") : "no front matter found"}), at the path ${pathFor(folder)}. Keys that have no matching field kind are text fields; edit ${schemaFile} to fit.`,
				...starterCollections(folder.keys, answers.locales.length > 1).notes,
			);
		}
	} else if (app.existingConfig !== undefined) {
		report.skipped.push(app.existingConfig);
		report.notes.push(
			`${app.existingConfig} already exists, so it was kept and no schema file was written. Add the plugins you want to it by hand; each one is one line (see .env.example for the values).`,
		);
	}
	// Under Cache Components a page cannot send a 503 for a site whose login is not set up, a proxy can. The blog theme brings a proxy that does it too.
	const proxyFile = `${root}proxy.ts`;
	const ownProxy = PROXY_FILES.map((name) => `${root}${name}`).find((file) => writer.exists(file));
	if (ownProxy) {
		report.notes.push(
			`${ownProxy} already exists and was left alone. To get a 503 page instead of a 200 with a logged error when the login settings are missing in production, call \`setupResponse(request, cms)\` (from "@monti-cms/nextjs/proxy") at the top of it and return what it gives when that is not undefined.`,
		);
	} else if (!answers.blogTheme) {
		planned.push({ file: proxyFile, content: INIT_PROXY_TEMPLATE });
	}
	planned.push(
		{ file: pageFile, content: adminPageTemplate(configImport(pageFile), { instant: usesCacheComponents }) },
		{ file: layoutFile, content: adminLayoutTemplate(configImport(layoutFile), { blocks: answers.blocks.length > 0 }) },
		{ file: routeFile, content: apiRouteTemplate(configImport(routeFile)) },
		{ file: ".env.example", content: envExampleTemplate(answers) },
	);
	if (docker) {
		const composeExisting = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"].find((file) =>
			writer.exists(file),
		);
		if (composeExisting) {
			report.skipped.push(composeExisting);
			report.notes.push(
				`${composeExisting} already exists and was left alone. Add this service to it (DATABASE_URL in .env.local points to it):\n${dockerComposeTemplate(dockerPort)}`,
			);
		} else planned.push({ file: "docker-compose.yml", content: dockerComposeTemplate(dockerPort) });
	}

	// Existing files: skipped, unless the person says to replace them.
	const writes: { file: string; content: string; replace: boolean }[] = [];
	for (const entry of planned) {
		if (!writer.exists(entry.file)) {
			writes.push({ ...entry, replace: false });
			continue;
		}
		if (writer.read(entry.file) === entry.content) {
			report.skipped.push(entry.file);
			continue;
		}
		const replace =
			options.overwrite === true ||
			(prompter !== undefined &&
				(await prompter.confirm({
					message: `${entry.file} already exists and differs. Overwrite it?`,
					initial: false,
				})));
		if (replace) writes.push({ ...entry, replace: true });
		else {
			report.skipped.push(entry.file);
			report.notes.push(`${entry.file} already exists and was kept. Run with --overwrite to replace it.`);
		}
	}

	// .env.local: only values typed or generated, and only names it does not have yet.
	const envLocalFile = ".env.local";
	const envLocalText = writer.exists(envLocalFile) ? writer.read(envLocalFile) : undefined;
	const have = envKeys(envLocalText ?? "");
	const secret = host.generateSecret();
	const wanted: [string, string | undefined][] = [
		["MONTI_SECRET", secret],
		["DATABASE_URL", databaseUrl],
		["DATABASE_SCHEMA", answers.databaseSchema],
		["MONTI_ADMIN_GITHUB_ID", answers.adminGithubId],
	];
	const envAdd = wanted.filter((pair): pair is [string, string] => pair[1] !== undefined && !have.has(pair[0]));
	for (const [name] of wanted) {
		if (have.has(name)) report.notes.push(`${name} is already set in ${envLocalFile}, so it was not changed.`);
	}
	let envLocalAfter: string | undefined;
	if (envAdd.length > 0) {
		const lines = envAdd
			.map(([name, value]) => `${name}=${/[\s#"'$]/.test(value) ? JSON.stringify(value) : value}`)
			.join("\n");
		envLocalAfter =
			envLocalText === undefined
				? `${ENV_LOCAL_HEADER}${lines}\n`
				: `${envLocalText}${envLocalText.endsWith("\n") || envLocalText === "" ? "" : "\n"}${lines}\n`;
	}

	// Edits to files the app owns: each shows its diff and, in the prompts, asks first. With no prompts the edit is made (it is what the run is for).
	const edits: { file: string; text: string; before: string; isNew: boolean }[] = [];
	const propose = async (file: string, before: string, after: string, question: string, isNew = false) => {
		prompter?.note(unifiedDiff(file, before, after), `Change to ${file}`);
		const apply = prompter ? await prompter.confirm({ message: question, initial: true }) : true;
		if (apply) edits.push({ file, text: after, before, isNew });
		return apply;
	};
	// The next config: merge withCms in when the shape allows.
	let nextConfigManual: string | undefined;
	if (app.nextConfig) {
		const before = writer.read(app.nextConfig);
		if (before.includes("withCms")) report.skipped.push(app.nextConfig);
		else {
			const merged = mergeWithCms(before);
			if (
				merged === undefined ||
				!(await propose(app.nextConfig, before, merged, `Add withCms to ${app.nextConfig}?`))
			) {
				nextConfigManual = app.nextConfig;
			}
		}
	} else {
		writes.push({ file: "next.config.ts", content: nextConfigTemplate(), replace: false });
	}
	// tsconfig: the config imports the schema JSON.
	let tsconfigManual = false;
	if (app.resolveJsonModule === false && !keepConfig) {
		const before = writer.read("tsconfig.json");
		const after = addResolveJsonModule(before);
		tsconfigManual =
			after === undefined ||
			!(await propose("tsconfig.json", before, after, 'Set "resolveJsonModule": true in tsconfig.json?'));
	}
	// The secret file must never be committed.
	let gitignoreManual = false;
	if (!app.envLocalIgnored) {
		const exists = writer.exists(".gitignore");
		const before = exists ? writer.read(".gitignore") : "";
		const after = addEnvToGitignore(exists ? before : undefined);
		gitignoreManual = !(await propose(".gitignore", before, after, "Add .env.local to .gitignore?", !exists));
	}

	// pnpm 12 stops an install until the packages that have an install script are allowed or denied (esbuild is one).
	const pnpmBuilds = planPnpmBuilds(cwd, manager, host, writer);
	let pnpmBuildsManual = pnpmBuilds.kind === "manual" ? pnpmBuilds.reason : undefined;
	if (pnpmBuilds.kind === "edit") {
		const accepted = await propose(
			pnpmBuilds.file,
			pnpmBuilds.before,
			pnpmBuilds.after,
			`Let pnpm run esbuild's install script (allowBuilds in ${pnpmBuilds.file}; pnpm ${pnpmBuilds.version} asks for it)?`,
			pnpmBuilds.isNew,
		);
		if (!accepted) pnpmBuildsManual = PNPM_BUILDS_HELP;
	}

	// The admin's theme provider puts its theme class on `<html>` before React hydrates, so the root layout must tell React to expect it.
	let hydrationManual: string | undefined;
	const rootLayout = findRootLayout(cwd);
	if (rootLayout) {
		const before = writer.read(rootLayout);
		if (hasSuppressHydrationWarning(before) === false) {
			const after = addSuppressHydrationWarning(before);
			if (
				after === undefined ||
				!(await propose(
					rootLayout,
					before,
					after,
					`Add suppressHydrationWarning to the <html> tag of ${rootLayout}? (the admin theme sets a class on it)`,
				))
			) {
				hydrationManual = rootLayout;
			}
		}
	}

	// What gets installed.
	const missing = packagesFor(answers).filter((name) => !app.dependencies.has(name));
	const installing = options.install !== false;
	const typography = answers.blogTheme && !app.tailwind.typography;

	// ---- Apply ----
	try {
		for (const entry of writes) {
			if (!dryRun) writer.write(entry.file, entry.content);
			(entry.replace ? report.overwritten : report.created).push(entry.file);
		}
		if (envLocalAfter !== undefined) {
			if (!dryRun) writer.write(envLocalFile, envLocalAfter);
			(envLocalText === undefined ? report.created : report.updated).push(envLocalFile);
			if (envLocalText !== undefined)
				report.notes.push(
					`Added ${envAdd.map(([name]) => name).join(", ")} to the existing ${envLocalFile}; its other lines were not touched.`,
				);
		}
		for (const edit of edits) {
			if (!dryRun) writer.write(edit.file, edit.text);
			(edit.isNew ? report.created : report.updated).push(edit.file);
			report.diffs.push({ file: edit.file, diff: unifiedDiff(edit.file, edit.before, edit.text) });
		}
	} catch (error) {
		throw new InitError(error instanceof Error ? error.message : String(error), writer.written);
	}
	report.skipped = [...new Set(report.skipped)];
	if (!dryRun) log(`Wrote ${writer.written.length} file${writer.written.length === 1 ? "" : "s"}`);

	// Docker, packages, tables, theme: each one a step that is recorded, so a failure is named and `--resume` runs only what did not finish.
	const envNow = envKeys(envLocalAfter ?? envLocalText ?? "");
	const hasDatabaseUrl =
		databaseUrl !== undefined || envNow.has("DATABASE_URL") || Boolean((options.env ?? process.env).DATABASE_URL);
	const outcome = await runInitSteps({
		cwd,
		host,
		log,
		dryRun,
		prompter,
		manager,
		answers,
		report,
		docker,
		dockerPort,
		dockerStart: options.dockerStart !== false,
		installing,
		migrateOn: options.migrate !== false,
		packages: missing,
		typography,
		databaseUrl,
		hasDatabaseUrl,
		env: options.env ?? process.env,
		envValues: parseEnvSafe(envLocalText ?? ""),
		already: new Set<StepId>(),
	});
	const { installed, migrated, databaseReady } = outcome;

	// ---- What is left ----
	const todo: string[] = [];
	const siteUrl = answers.siteUrl;
	if (nextConfigManual) {
		todo.push(
			`Wrap the config in ${nextConfigManual}. Add this import at the top and export the result of withCms:\nimport { withCms } from "@monti-cms/nextjs/config";\nexport default withCms(nextConfig);   // wherever you export your config now`,
		);
	}
	if (tsconfigManual) {
		todo.push(
			`Set "resolveJsonModule": true in compilerOptions of tsconfig.json (${configFile} imports ${schemaFile}).`,
		);
	}
	if (!app.typescript) {
		todo.push(
			"Add TypeScript (monti.config.ts and the Next files are .ts/.tsx): " +
				commandText(addCommand(manager, ["typescript", "@types/react", "@types/node"], cwd, true)),
		);
	}
	if (hydrationManual) {
		todo.push(
			`Add suppressHydrationWarning to the <html> tag in ${hydrationManual} (<html lang="en" suppressHydrationWarning>). The admin's theme provider sets a class on <html> before React hydrates, and without it the first admin screen logs a hydration mismatch.`,
		);
	}
	if (gitignoreManual) todo.push("Add .env.local to .gitignore: it holds MONTI_SECRET (and your database URL).");
	// A step that failed: the exact commands that finish the job, in order. They replace the separate "install" and "create the tables" items below.
	const hasFailure = report.steps.some((step) => step.status === "failed");
	if (hasFailure && !dryRun) {
		report.recovery = [
			...(pnpmBuildsManual ? [pnpmBuildsManual] : []),
			...recoveryCommands({ report, manager, cwd, packages: missing, hasDatabaseUrl }),
		];
		report.resumeCommand = exec(manager, "init --resume");
		await ensureStateIgnored(writer, prompter, report);
		writeInitState(cwd, {
			version: 1,
			manager,
			answers: report.answers,
			packages: missing,
			typography,
			...(docker ? { dockerPort } : {}),
			steps: stepStates(report.steps, {}),
		});
	} else if (!dryRun) {
		clearInitState(cwd);
	}
	if (pnpmBuildsManual && !hasFailure) todo.push(pnpmBuildsManual);
	const willInstall = installed || (dryRun && installing);
	if (missing.length > 0 && !willInstall && !hasFailure) {
		todo.push(`Install the packages:\n${commandText(addCommand(manager, missing, cwd))}`);
	}
	if (!hasDatabaseUrl) {
		todo.push(
			`Put your Postgres URL in DATABASE_URL in .env.local, then create the tables: ${exec(manager, "migrate")}`,
		);
	} else if (!hasFailure) {
		if (docker && !databaseReady && !dryRun) {
			todo.push(
				`Start the database: docker compose up -d${host.dockerAvailable() ? "" : " (install and start Docker first)"}`,
			);
		}
		if (!migrated && !(dryRun && options.migrate !== false && installing)) {
			todo.push(`Create the tables: ${exec(manager, "migrate")}`);
		}
	}
	todo.push(
		[
			"Create a GitHub OAuth app for the admin login (needed for production; under `next dev` you are signed in without it):",
			"  https://github.com/settings/developers > OAuth Apps > New OAuth App",
			`  Homepage URL:               ${siteUrl}`,
			`  Authorization callback URL: ${githubCallbackUrl(siteUrl)}`,
			"  Put the Client ID in AUTH_GITHUB_ID and a new client secret in AUTH_GITHUB_SECRET (.env.local).",
			`  For the deployed site add its URL the same way, e.g. https://your-domain.com/api/cms/auth/callback/github.`,
		].join("\n"),
	);
	if (!answers.adminGithubId && !have.has("MONTI_ADMIN_GITHUB_ID")) {
		todo.push(
			'Put your numeric GitHub id in MONTI_ADMIN_GITHUB_ID in .env.local (open https://api.github.com/users/<your-name> and copy the "id").',
		);
	}
	if (answers.storage === "s3") {
		todo.push(
			"Fill the image storage values in .env.local: S3_ENDPOINT (R2: https://<account>.r2.cloudflarestorage.com, MinIO: http://localhost:9000), S3_REGION (R2: auto), S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL (the public address of the files; MinIO also S3_FORCE_PATH_STYLE=true).",
		);
	}
	if (answers.gitSync) {
		todo.push(
			`Name the repo to sync: add a target to gitSync() in ${configFile}, then open ${answers.adminPath}/git-sync to save the GitHub token. Run ${exec(manager, "migrate")} again after adding the plugin if you did not just run it.`,
		);
	}
	todo.push(
		`Check the setup whenever something does not work: ${exec(manager, "doctor")} lists every check as ok, warn or fail, and for each problem says what is wrong, where, and how to fix it.`,
	);
	todo.push(`Start the app: ${script(manager, "dev")}, then open ${siteUrl}${answers.adminPath}`);
	const folder = app.contentFolders[0];
	if (folder) {
		todo.push(
			`Bring in your existing posts (${app.contentFolders.map((entry) => `${entry.files} in ${entry.dir}/`).join(", ")}): ${exec(manager, `import ${folder.dir}`)}`,
		);
	}
	report.next.unshift(...todo);
	if (hasFailure) report.ok = false;
	return report;
}

// ---- pnpm 12: esbuild's install script ----

const PNPM_BUILDS_FILE = "pnpm-workspace.yaml";

/** What to do by hand about `allowBuilds`, with the exact lines. */
const PNPM_BUILDS_HELP = `pnpm 12 stops an install until esbuild's install script is allowed or denied. In ${PNPM_BUILDS_FILE} (at the root of the workspace) set it once, keeping the other lines and not adding a second allowBuilds key:\nallowBuilds:\n  esbuild: true\n(if the file already has \`esbuild: set this to true or false\`, change that value to true)`;

type PnpmBuilds =
	| { readonly kind: "none" }
	| { readonly kind: "manual"; readonly reason: string }
	| {
			readonly kind: "edit";
			readonly file: string;
			readonly before: string;
			readonly after: string;
			readonly isNew: boolean;
			readonly version: string;
	  };

/** The version of pnpm: asked of the program, else the `packageManager` field of package.json. */
function pnpmVersionOf(cwd: string, host: InitHost): string | undefined {
	const asked = host.pnpmVersion(cwd);
	if (asked) return asked;
	try {
		const field = (JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as { packageManager?: unknown })
			.packageManager;
		return typeof field === "string" && field.startsWith("pnpm@") ? field.slice(5).split("+")[0] : undefined;
	} catch {
		return undefined;
	}
}

/**
 * With pnpm 12 and no decision about esbuild's install script (`allowBuilds.esbuild` missing, or still the `set this to true or false` placeholder pnpm wrote),
 * the edit of `pnpm-workspace.yaml` that allows it. Nothing for older pnpm, for other managers, or when the person already decided; the lines to add by hand when the
 * file is not the app's own or is shaped so that an edit is not safe.
 */
function planPnpmBuilds(cwd: string, manager: PackageManager, host: InitHost, writer: ProjectWriter): PnpmBuilds {
	if (manager !== "pnpm") return { kind: "none" };
	const version = pnpmVersionOf(cwd, host);
	const major = Number.parseInt(version ?? "", 10);
	if (!version || !Number.isFinite(major) || major < 12) return { kind: "none" };
	const exists = writer.exists(PNPM_BUILDS_FILE);
	if (!exists) {
		for (let dir = path.dirname(path.resolve(cwd)); ; dir = path.dirname(dir)) {
			if (existsSync(path.join(dir, PNPM_BUILDS_FILE))) {
				return {
					kind: "manual",
					reason: `The workspace file is ${path.join(dir, PNPM_BUILDS_FILE)}, outside this app. ${PNPM_BUILDS_HELP}`,
				};
			}
			if (path.dirname(dir) === dir) break;
		}
	}
	const before = exists ? writer.read(PNPM_BUILDS_FILE) : undefined;
	const after = allowEsbuildBuild(before);
	if (after === "ok") return { kind: "none" };
	if (after === undefined) return { kind: "manual", reason: PNPM_BUILDS_HELP };
	return { kind: "edit", file: PNPM_BUILDS_FILE, before: before ?? "", after, isNew: !exists, version };
}

/** The progress file is local: `.monti/` goes into `.gitignore` (shown as a diff, and asked first when a person is at the terminal) before the file is written. */
async function ensureStateIgnored(
	writer: ProjectWriter,
	prompter: Prompter | undefined,
	report: InitReport,
): Promise<void> {
	const exists = writer.exists(".gitignore");
	const before = exists ? writer.read(".gitignore") : "";
	const after = addStateToGitignore(exists ? before : undefined);
	if (after === before) return;
	prompter?.note(unifiedDiff(".gitignore", before, after), "Change to .gitignore");
	if (
		prompter &&
		!(await prompter.confirm({
			message: "Add .monti/ to .gitignore? (it holds the progress of monti init)",
			initial: true,
		}))
	) {
		report.notes.push("Add .monti/ to .gitignore: it holds the progress of `monti init` and is for this machine only.");
		return;
	}
	writer.write(".gitignore", after);
	(exists ? report.updated : report.created).push(".gitignore");
	report.diffs.push({ file: ".gitignore", diff: unifiedDiff(".gitignore", before, after) });
}

// ---- The steps after the files are written ----

const TYPOGRAPHY_PACKAGE = "@tailwindcss/typography";

const STEP_NAMES: Record<StepId, string> = {
	docker: "Start Postgres in Docker",
	install: "Install packages",
	migrate: "Run monti migrate",
	typography: `Install ${TYPOGRAPHY_PACKAGE}`,
	theme: "Add the blog theme",
};

interface StepsInput {
	readonly cwd: string;
	readonly host: InitHost;
	readonly log: (message: string) => void;
	readonly dryRun: boolean;
	readonly prompter?: Prompter;
	readonly manager: PackageManager;
	readonly answers: InitAnswers;
	readonly report: InitReport;
	readonly docker: boolean;
	readonly dockerPort: number;
	readonly dockerStart: boolean;
	/** `--no-install` is not given. */
	readonly installing: boolean;
	/** `--no-migrate` is not given. */
	readonly migrateOn: boolean;
	/** The packages the install step adds. */
	readonly packages: readonly string[];
	/** Install the typography plugin (the blog theme was chosen and the app does not have it). */
	readonly typography: boolean;
	readonly databaseUrl: string | undefined;
	readonly hasDatabaseUrl: boolean;
	readonly env: Record<string, string | undefined>;
	readonly envValues: Record<string, string | undefined>;
	/** Steps finished by an earlier run (`--resume`): they are not run again. */
	readonly already: ReadonlySet<StepId>;
}

interface StepsOutcome {
	readonly installed: boolean;
	readonly migrated: boolean;
	readonly databaseReady: boolean;
}

/**
 * Runs the Docker database, the package install, the tables, the typography plugin and the blog theme, in that order, and records each in `report.steps` with its
 * id. A step that fails is recorded as failed (and `report.ok` turns false); one that cannot run because an earlier step did not finish is recorded as skipped with
 * `retry`, which is what `monti init --resume` runs again. Nothing here throws.
 */
async function runInitSteps(input: StepsInput): Promise<StepsOutcome> {
	const { cwd, host, log, dryRun, prompter, manager, answers, report, already } = input;
	const record = (id: StepId, status: InitStep["status"], detail?: string, retry = false) =>
		report.steps.push({
			id,
			name: STEP_NAMES[id],
			status,
			...(detail ? { detail } : {}),
			...(retry ? { retry: true } : {}),
		});
	const fail = (id: StepId, error: unknown) => {
		report.ok = false;
		record(id, "failed", error instanceof Error ? error.message : String(error), true);
	};

	// Docker database
	let databaseReady = false;
	if (input.docker && !already.has("docker")) {
		if (!input.dockerStart) record("docker", "skipped", "--no-docker-start");
		else if (dryRun) record("docker", "planned", "docker compose up -d");
		else if (!host.dockerAvailable()) record("docker", "skipped", "Docker is not running or not installed", true);
		else {
			log("Starting Postgres with docker compose ...");
			if (host.run("docker", ["compose", "up", "-d"], cwd)) {
				record("docker", "done", `localhost:${input.dockerPort}`);
				databaseReady = true;
			} else fail("docker", "`docker compose up -d` failed");
		}
	}

	// Packages
	let installed = already.has("install");
	if (!installed) {
		report.installed = [...input.packages];
		if (input.packages.length > 0 || answers.blogTheme) {
			if (!input.installing) record("install", "skipped", "--no-install");
			else if (dryRun) record("install", "planned", commandText(addCommand(manager, input.packages, cwd)));
			else if (input.packages.length > 0) {
				log(`Installing ${input.packages.length} packages with ${manager} ...`);
				try {
					await host.install(addCommand(manager, input.packages, cwd));
					installed = true;
					record("install", "done", `${input.packages.length} packages with ${manager}`);
				} catch (error) {
					fail("install", error);
				}
			} else installed = true;
		} else installed = true;
		if (input.packages.length === 0) report.installed = [];
	}

	// The tables
	let migrated = already.has("migrate");
	if (!migrated) {
		if (dryRun) record("migrate", "planned", input.hasDatabaseUrl ? undefined : "needs DATABASE_URL");
		else if (!input.migrateOn || !input.installing) {
			record("migrate", "skipped", !input.migrateOn ? "--no-migrate" : "packages not installed");
		} else if (!installed) {
			record("migrate", "skipped", "packages are not installed", true);
		} else if (!input.hasDatabaseUrl) {
			record("migrate", "skipped", "DATABASE_URL is not set", true);
		} else {
			const url = input.databaseUrl ?? input.envValues.DATABASE_URL ?? input.env.DATABASE_URL;
			const reachable = url ? await host.databaseReachable(url, databaseReady ? 30000 : 0) : false;
			if (!reachable) {
				record("migrate", "skipped", "the database is not reachable yet", true);
			} else {
				log("Running monti migrate ...");
				try {
					migrated = await host.migrate(cwd);
					if (migrated) record("migrate", "done", "tables created");
					else fail("migrate", "`monti migrate` failed");
				} catch (error) {
					fail("migrate", error);
				}
			}
		}
	}

	// The typography plugin, which the theme's text styles (`prose`) need
	let typographyDone = already.has("typography") || !input.typography;
	if (!typographyDone) {
		if (dryRun) record("typography", "planned", commandText(addCommand(manager, [TYPOGRAPHY_PACKAGE], cwd, true)));
		else if (!input.installing) record("typography", "skipped", "--no-install");
		else if (!installed) record("typography", "skipped", "packages are not installed", true);
		else {
			log(`Installing ${TYPOGRAPHY_PACKAGE} ...`);
			try {
				await host.install(addCommand(manager, [TYPOGRAPHY_PACKAGE], cwd, true));
				typographyDone = true;
				record("typography", "done", "dev dependency");
			} catch (error) {
				fail("typography", error);
			}
		}
	}

	// Blog theme (through the registry, like `monti add blog-theme`)
	if (answers.blogTheme && !already.has("theme")) {
		if (dryRun) record("theme", "planned", "monti add blog-theme");
		else if (!input.installing) record("theme", "skipped", "--no-install");
		else if (!installed || !typographyDone) record("theme", "skipped", "packages are not installed", true);
		else {
			try {
				const added = await addComponents({
					cwd,
					names: ["blog-theme"],
					// The typography plugin is installed by its own step.
					install: (command) =>
						command.args.includes(TYPOGRAPHY_PACKAGE) && typographyDone ? undefined : host.install(command),
					prompter,
					yes: prompter === undefined,
					blocks: answers.blocks.length > 0,
				});
				report.created.push(...added.created);
				if (added.styles?.updated) report.updated.push(added.styles.updated);
				if (added.styles?.diff) report.diffs.push(added.styles.diff);
				report.skipped.push(...added.unchanged);
				report.notes.push(...added.configured);
				report.next.push(...added.manual);
				if (added.conflicts.length > 0) {
					report.ok = false;
					record("theme", "failed", `${added.created.length} files`, true);
					report.notes.push(
						`These blog theme files already exist and differ, so nothing of the theme was written: ${added.conflicts.join(", ")}. Run \`monti add blog-theme --overwrite\` to replace them.`,
					);
				} else record("theme", "done", `${added.created.length} files`);
			} catch (error) {
				fail("theme", error);
			}
		}
	}
	return { installed, migrated, databaseReady };
}

/** What each step ended as, for the saved state: finished, to run again, or left out on purpose. A step the report does not mention keeps its earlier state. */
function stepStates(
	steps: readonly InitStep[],
	before: Partial<Record<StepId, StepState>>,
): Partial<Record<StepId, StepState>> {
	const out: Partial<Record<StepId, StepState>> = { ...before };
	for (const step of steps) {
		if (!step.id || step.status === "planned") continue;
		out[step.id] = step.status === "done" ? "done" : step.status === "failed" || step.retry ? "incomplete" : "skipped";
	}
	return out;
}

/** The exact commands for the steps that did not finish, in the order to run them. */
function recoveryCommands(input: {
	readonly report: InitReport;
	readonly manager: PackageManager;
	readonly cwd: string;
	readonly packages: readonly string[];
	readonly hasDatabaseUrl: boolean;
}): string[] {
	const { report, manager, cwd } = input;
	const open = new Set(report.steps.filter((step) => step.status === "failed" || step.retry).map((step) => step.id));
	const out: string[] = [];
	for (const id of STEP_ORDER) {
		if (!open.has(id)) continue;
		if (id === "docker") out.push("docker compose up -d   (start Docker first if it is not running)");
		else if (id === "install" && input.packages.length > 0)
			out.push(commandText(addCommand(manager, input.packages, cwd)));
		else if (id === "migrate" && input.hasDatabaseUrl) out.push(exec(manager, "migrate"));
		else if (id === "typography") out.push(commandText(addCommand(manager, [TYPOGRAPHY_PACKAGE], cwd, true)));
		else if (id === "theme") {
			const conflict = report.notes.some((note) => note.includes("blog theme files already exist"));
			out.push(exec(manager, `add blog-theme --yes${conflict ? " --overwrite" : ""}`));
		}
	}
	return out;
}

/**
 * `monti init --resume`: runs again only the steps the last run did not complete, from the progress saved in `.monti/init.json`. It asks nothing about the app and
 * writes none of the files `monti init` wrote; the one file it may edit is `pnpm-workspace.yaml` (pnpm 12 and esbuild), with a diff and a confirmation.
 */
async function resumeInit(options: InitOptions): Promise<InitReport> {
	const { cwd } = options;
	const host: InitHost = { ...defaultInitHost, ...options.host };
	const log = options.log ?? (() => undefined);
	const dryRun = options.dryRun === true;
	const prompter = options.prompter;

	const state = readInitState(cwd);
	if (!state) {
		throw new Error(
			"Nothing to resume: there is no saved progress in .monti/init.json. `monti init` saves it when a step fails. Run `monti init` to set up the app.",
		);
	}
	const app = detectApp(cwd);
	const manager = options.packageManager ?? state.manager;
	const writer = new ProjectWriter(cwd);
	const answers = state.answers;
	const done = new Set<StepId>(STEP_ORDER.filter((id) => state.steps[id] === "done"));
	const packages = state.packages.filter((name) => !app.dependencies.has(name));
	if (packages.length === 0) done.add("install");
	if (!state.typography || app.dependencies.has(TYPOGRAPHY_PACKAGE)) done.add("typography");

	const envFile = ".env.local";
	const envValues = parseEnvSafe(writer.exists(envFile) ? writer.read(envFile) : "");
	const env = options.env ?? process.env;
	const hasDatabaseUrl = Boolean(envValues.DATABASE_URL || env.DATABASE_URL);

	prompter?.intro(`Finish adding Monti to ${app.packageName ?? "this app"}`);
	const report: InitReport = {
		ok: true,
		dryRun,
		resumed: true,
		app: {
			name: app.packageName,
			next: app.next,
			src: app.src,
			packageManager: manager,
			typescript: app.typescript,
			tailwind: app.tailwind,
			contentFolders: app.contentFolders.map(({ dir, files }) => ({ dir, files })),
		},
		answers,
		created: [],
		skipped: [],
		updated: [],
		overwritten: [],
		installed: [],
		steps: [],
		diffs: [],
		notes: [],
		next: [],
		recovery: [],
	};

	// pnpm 12 may be what stopped the install: set esbuild's decision first.
	let pnpmBuildsManual: string | undefined;
	const builds = planPnpmBuilds(cwd, manager, host, writer);
	if (builds.kind === "manual") pnpmBuildsManual = builds.reason;
	else if (builds.kind === "edit") {
		prompter?.note(unifiedDiff(builds.file, builds.before, builds.after), `Change to ${builds.file}`);
		const apply = prompter
			? await prompter.confirm({
					message: `Let pnpm run esbuild's install script (allowBuilds in ${builds.file})?`,
					initial: true,
				})
			: true;
		if (apply) {
			if (!dryRun) writer.write(builds.file, builds.after);
			(builds.isNew ? report.created : report.updated).push(builds.file);
			report.diffs.push({ file: builds.file, diff: unifiedDiff(builds.file, builds.before, builds.after) });
		} else pnpmBuildsManual = PNPM_BUILDS_HELP;
	}

	const docker = answers.database.kind === "docker";
	const outcome = await runInitSteps({
		cwd,
		host,
		log,
		dryRun,
		prompter,
		manager,
		answers,
		report,
		docker,
		dockerPort: state.dockerPort ?? 5432,
		dockerStart: options.dockerStart !== false,
		installing: options.install !== false,
		migrateOn: options.migrate !== false,
		packages,
		typography: state.typography,
		databaseUrl: undefined,
		hasDatabaseUrl,
		env,
		envValues,
		already: done,
	});

	const hasFailure = report.steps.some((step) => step.status === "failed");
	if (hasFailure && !dryRun) {
		report.recovery = [
			...(pnpmBuildsManual ? [pnpmBuildsManual] : []),
			...recoveryCommands({ report, manager, cwd, packages, hasDatabaseUrl }),
		];
		report.resumeCommand = exec(manager, "init --resume");
		await ensureStateIgnored(writer, prompter, report);
		writeInitState(cwd, { ...state, steps: stepStates(report.steps, state.steps) });
	} else if (!dryRun) {
		clearInitState(cwd);
	}
	if (pnpmBuildsManual && !hasFailure) report.next.push(pnpmBuildsManual);
	if (!hasDatabaseUrl) {
		report.next.push(
			`Put your Postgres URL in DATABASE_URL in .env.local, then create the tables: ${exec(manager, "migrate")}`,
		);
	} else if (!hasFailure && !outcome.migrated && !done.has("migrate") && !dryRun) {
		if (docker && !outcome.databaseReady) report.next.push("Start the database: docker compose up -d");
		report.next.push(`Create the tables: ${exec(manager, "migrate")}`);
	}
	report.next.push(
		`Check the setup whenever something does not work: ${exec(manager, "doctor")}`,
		`Start the app: ${script(manager, "dev")}, then open ${answers.siteUrl}${answers.adminPath}`,
	);
	if (hasFailure) report.ok = false;
	return report;
}

const WORDS: Record<InitStep["status"], string> = {
	done: "done",
	skipped: "skipped",
	failed: "FAILED",
	planned: "planned",
};

/** The plain summary: what was done, then what is left, numbered. */
export function formatInitReport(report: InitReport): string {
	const dry = report.dryRun;
	const list = (title: string, items: readonly string[]) =>
		items.length === 0 ? [] : [title, ...items.map((item) => `  - ${item}`), ""];
	const out: string[] = [];
	const failedCount = report.steps.filter((step) => step.status === "failed").length;
	out.push(
		dry
			? "Dry run: nothing was written. This is what would happen."
			: failedCount > 0
				? `Monti is only partly added: ${failedCount === 1 ? "1 step failed" : `${failedCount} steps failed`}. The files are written; the steps below did not finish.`
				: report.resumed
					? "Resumed: the steps that were left are run."
					: "Monti is added to your app.",
		"",
	);
	out.push(
		...list(dry ? "Would create:" : "Created:", report.created),
		...list(dry ? "Would change:" : "Changed:", report.updated),
		...list(dry ? "Would replace:" : "Replaced (you said yes):", report.overwritten),
		...list("Left as they were:", report.skipped),
	);
	for (const { file, diff } of report.diffs)
		out.push(`Change to ${file}:`, ...diff.split("\n").map((line) => `    ${line}`), "");
	if (report.steps.length > 0) {
		out.push("Steps:");
		for (const step of report.steps)
			out.push(`  - ${step.name}: ${WORDS[step.status]}${step.detail ? ` (${step.detail})` : ""}`);
		out.push("");
	}
	if (report.recovery.length > 0) {
		out.push("To finish, run these in order:");
		for (const [index, command] of report.recovery.entries())
			out.push(`  ${index + 1}. ${command.replaceAll("\n", "\n     ")}`);
		if (report.resumeCommand)
			out.push(
				`Or run ${report.resumeCommand}: it runs only the steps that did not finish (the progress is saved in .monti/init.json).`,
			);
		out.push("");
	}
	if (report.notes.length > 0) {
		out.push("Notes:", ...report.notes.map((note) => `  - ${note.replaceAll("\n", "\n    ")}`), "");
	}
	if (report.next.length > 0) {
		out.push("What is left:");
		for (const [index, step] of report.next.entries()) out.push(`  ${index + 1}. ${step.replaceAll("\n", "\n     ")}`);
	}
	return out.join("\n").trimEnd();
}

export { InitCancelled, unifiedDiff };
