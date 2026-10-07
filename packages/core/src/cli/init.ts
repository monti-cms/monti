import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { parseEnv } from "node:util";
import { parseSchemaFile } from "../schema-file/format";
import { addComponents, type InstallCommand } from "./add";
import { detectApp, type PackageManager } from "./init-detect";
import { addEnvToGitignore, addResolveJsonModule } from "./init-edits";
import { collectAnswers, type InitAnswerFlags, InitCancelled, type Prompter } from "./init-prompts";
import { migrate } from "./migrate";
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
	schemaTemplate,
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
	/** Override the detected package manager. */
	readonly packageManager?: PackageManager;
	/** Progress lines while the work runs. */
	readonly log?: (message: string) => void;
	readonly host?: Partial<InitHost>;
	/** The environment to look for `DATABASE_URL` in. Default: `process.env`. */
	readonly env?: Record<string, string | undefined>;
}

export interface InitStep {
	readonly name: string;
	readonly status: "done" | "skipped" | "failed" | "planned";
	readonly detail?: string;
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

/** A unified diff of two texts, with 2 lines of context. Files are small, so a plain LCS is enough. */
export function unifiedDiff(file: string, before: string, after: string): string {
	const a = before.split("\n");
	const b = after.split("\n");
	const width = b.length + 1;
	// lcs[i * width + j]: length of the longest common run of a[i..] and b[j..]
	const lcs = new Array<number>((a.length + 1) * width).fill(0);
	const at = (i: number, j: number) => lcs[i * width + j] ?? 0;
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i * width + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
		}
	}
	const ops: { op: " " | "-" | "+"; line: string }[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			ops.push({ op: " ", line: a[i] ?? "" });
			i++;
			j++;
		} else if (i < a.length && (j >= b.length || at(i + 1, j) >= at(i, j + 1))) {
			ops.push({ op: "-", line: a[i] ?? "" });
			i++;
		} else {
			ops.push({ op: "+", line: b[j] ?? "" });
			j++;
		}
	}
	const CONTEXT = 2;
	const lines = [`--- a/${file}`, `+++ b/${file}`];
	let gap = false;
	for (const [index, entry] of ops.entries()) {
		const near = ops.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some((other) => other.op !== " ");
		if (!near) {
			gap = true;
			continue;
		}
		if (gap && lines.length > 2) lines.push("...");
		gap = false;
		lines.push(`${entry.op}${entry.line}`);
	}
	return lines.join("\n");
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
				(folder) => `Found ${folder.files} Markdown/MDX file${folder.files === 1 ? "" : "s"} in ${folder.dir}/`,
			),
		].join("\n"),
		"Detected",
	);

	const answers = await collectAnswers(app, options, prompter);

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
	};

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
				`The post collection follows the front matter of ${folder.dir}/ (${keys.length > 0 ? keys.slice(0, 8).join(", ") : "no front matter found"}). Keys that have no matching field kind are text fields; edit ${schemaFile} to fit.`,
			);
		}
	} else if (app.existingConfig !== undefined) {
		report.skipped.push(app.existingConfig);
		report.notes.push(
			`${app.existingConfig} already exists, so it was kept and no schema file was written. Add the plugins you want to it by hand; each one is one line (see .env.example for the values).`,
		);
	}
	planned.push(
		{ file: pageFile, content: adminPageTemplate(configImport(pageFile)) },
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

	// What gets installed.
	const missing = packagesFor(answers).filter((name) => !app.dependencies.has(name));
	const installing = options.install !== false;

	// ---- Apply ----
	const failed = (message: string, step: string): void => {
		report.ok = false;
		report.steps.push({ name: step, status: "failed", detail: message });
	};
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

	// Docker database
	let databaseReady = false;
	if (docker) {
		if (options.dockerStart === false) {
			report.steps.push({ name: "Start Postgres in Docker", status: "skipped", detail: "--no-docker-start" });
		} else if (dryRun) {
			report.steps.push({ name: "Start Postgres in Docker", status: "planned", detail: "docker compose up -d" });
		} else if (!host.dockerAvailable()) {
			report.steps.push({
				name: "Start Postgres in Docker",
				status: "skipped",
				detail: "Docker is not running or not installed",
			});
		} else {
			log("Starting Postgres with docker compose ...");
			if (host.run("docker", ["compose", "up", "-d"], cwd)) {
				report.steps.push({ name: "Start Postgres in Docker", status: "done", detail: `localhost:${dockerPort}` });
				databaseReady = true;
			} else failed("`docker compose up -d` failed", "Start Postgres in Docker");
		}
	}

	// Packages
	let installed = false;
	report.installed = missing;
	if (missing.length > 0 || answers.blogTheme) {
		if (!installing) report.steps.push({ name: "Install packages", status: "skipped", detail: "--no-install" });
		else if (dryRun)
			report.steps.push({
				name: "Install packages",
				status: "planned",
				detail: commandText(addCommand(manager, missing, cwd)),
			});
		else if (missing.length > 0) {
			const command = addCommand(manager, missing, cwd);
			log(`Installing ${missing.length} packages with ${manager} ...`);
			try {
				await host.install(command);
				installed = true;
				report.steps.push({
					name: "Install packages",
					status: "done",
					detail: `${missing.length} packages with ${manager}`,
				});
			} catch (error) {
				failed(error instanceof Error ? error.message : String(error), "Install packages");
			}
		} else installed = true;
	} else installed = true;
	if (missing.length === 0) report.installed = [];

	// Migrate
	const envNow = envKeys(envLocalAfter ?? envLocalText ?? "");
	const envValues = parseEnvSafe(envLocalText ?? "");
	const hasDatabaseUrl =
		databaseUrl !== undefined || envNow.has("DATABASE_URL") || Boolean((options.env ?? process.env).DATABASE_URL);
	let migrated = false;
	if (dryRun)
		report.steps.push({
			name: "Run monti migrate",
			status: "planned",
			detail: hasDatabaseUrl ? undefined : "needs DATABASE_URL",
		});
	else if (options.migrate === false || !installing) {
		report.steps.push({
			name: "Run monti migrate",
			status: "skipped",
			detail: options.migrate === false ? "--no-migrate" : "packages not installed",
		});
	} else if (!installed) {
		report.steps.push({ name: "Run monti migrate", status: "skipped", detail: "packages are not installed" });
	} else if (!hasDatabaseUrl) {
		report.steps.push({ name: "Run monti migrate", status: "skipped", detail: "DATABASE_URL is not set" });
	} else {
		const url = databaseUrl ?? envValues.DATABASE_URL ?? (options.env ?? process.env).DATABASE_URL;
		const reachable = url ? await host.databaseReachable(url, databaseReady ? 30000 : 0) : false;
		if (!reachable) {
			report.steps.push({ name: "Run monti migrate", status: "skipped", detail: "the database is not reachable yet" });
		} else {
			log("Running monti migrate ...");
			try {
				migrated = await host.migrate(cwd);
			} catch (error) {
				failed(error instanceof Error ? error.message : String(error), "Run monti migrate");
			}
			if (migrated) report.steps.push({ name: "Run monti migrate", status: "done", detail: "tables created" });
			else if (!report.steps.some((step) => step.name === "Run monti migrate"))
				failed("`monti migrate` failed", "Run monti migrate");
		}
	}

	// Blog theme (through the registry, like `monti add blog-theme`)
	if (answers.blogTheme) {
		if (dryRun) report.steps.push({ name: "Add the blog theme", status: "planned", detail: "monti add blog-theme" });
		else if (!installing) report.steps.push({ name: "Add the blog theme", status: "skipped", detail: "--no-install" });
		else {
			try {
				const added = await addComponents({ cwd, names: ["blog-theme"], install: (command) => host.install(command) });
				report.created.push(...added.created);
				report.skipped.push(...added.unchanged);
				report.next.push(...added.manual);
				report.steps.push({
					name: "Add the blog theme",
					status: added.conflicts.length > 0 ? "failed" : "done",
					detail: `${added.created.length} files`,
				});
				if (added.conflicts.length > 0) {
					report.ok = false;
					report.notes.push(
						`These blog theme files already exist and differ, so nothing of the theme was written: ${added.conflicts.join(", ")}. Run \`monti add blog-theme --overwrite\` to replace them.`,
					);
				}
			} catch (error) {
				failed(error instanceof Error ? error.message : String(error), "Add the blog theme");
			}
		}
	}

	// ---- What is left ----
	const todo: string[] = [];
	const siteUrl = answers.siteUrl;
	const failedStep = (name: string) => report.steps.some((step) => step.name === name && step.status === "failed");
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
	if (gitignoreManual) todo.push("Add .env.local to .gitignore: it holds MONTI_SECRET (and your database URL).");
	const willInstall = installed || (dryRun && installing);
	if (missing.length > 0 && !willInstall) {
		todo.push(`Install the packages:\n${commandText(addCommand(manager, missing, cwd))}`);
	}
	if (!hasDatabaseUrl) {
		todo.push(
			`Put your Postgres URL in DATABASE_URL in .env.local, then create the tables: ${exec(manager, "migrate")}`,
		);
	} else {
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
	if (answers.blogTheme) {
		todo.push(
			`Point the theme at your fields: in the theme.config.ts that was added under components/monti/blog-theme (the @/components alias), set excerptField to "summary" and authorField/topicsField to undefined (the starter collection has neither).`,
		);
		if (!app.tailwind.typography) {
			todo.push(
				`The theme styles the body with the prose classes: ${commandText(addCommand(manager, ["@tailwindcss/typography"], cwd, true))}, then add @plugin "@tailwindcss/typography"; to your global CSS.`,
			);
		}
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
	if (failedStep("Install packages") && missing.length > 0) report.ok = false;
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
	out.push(dry ? "Dry run: nothing was written. This is what would happen." : "Monti is added to your app.", "");
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
	if (report.notes.length > 0) {
		out.push("Notes:", ...report.notes.map((note) => `  - ${note.replaceAll("\n", "\n    ")}`), "");
	}
	if (report.next.length > 0) {
		out.push("What is left:");
		for (const [index, step] of report.next.entries()) out.push(`  ${index + 1}. ${step.replaceAll("\n", "\n     ")}`);
	}
	return out.join("\n").trimEnd();
}

export { InitCancelled };
