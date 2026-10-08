import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { detectPackageManager, type InstallCommand } from "../add";
import { unifiedDiff } from "../diff";
import type { Prompter } from "../init-prompts";
import { type EjectablePackage, ejectability } from "./allowlist";
import { EJECTED_FILE, type EjectedPackage, ejectedText, readEjected } from "./record";

/**
 * `monti eject <package>`: copies the source of a UI package from the installed version into the site as a workspace package, points the app's dependency at the
 * copy and records what it did. From then on the package is the site's: `pnpm up` no longer changes it.
 *
 * Where the copy goes: `packages/monti-<name>/`. A workspace package is the one shape every package manager links live (an edit shows on the next reload, with no
 * reinstall) and resolves the package's own dependencies for (a `link:` or `file:` folder would not get its peer dependencies installed). `packages/` is where
 * workspace packages conventionally live, and it is under version control with the rest of the site, unlike `node_modules` or a `vendor/` folder of tarballs.
 *
 * The package keeps its name, so `import ... from "@monti-cms/admin"` in the site and in other Monti packages (which list it as a peer) needs no change.
 */

export class EjectError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EjectError";
	}
}

export interface EjectOptions {
	readonly cwd: string;
	/** The npm name of the package, e.g. `@monti-cms/admin`. */
	readonly name: string;
	/** Only report what would be written and run. */
	readonly dryRun?: boolean;
	/** Do not ask. Without it (and without a prompter) nothing is changed: ejecting hands the package's upgrades over to the site, so it is confirmed. */
	readonly yes?: boolean;
	/** Skip the package manager's install after the files are written (print the command instead). */
	readonly install?: boolean;
	/** Runs the package manager. Default: spawns it with the terminal attached. A non-zero exit is an error. */
	readonly runInstall?: (command: InstallCommand) => void | Promise<void>;
	readonly prompter?: Pick<Prompter, "note" | "confirm">;
	/** For tests. Default: now. */
	readonly now?: () => Date;
}

export interface EjectReport {
	readonly dryRun: boolean;
	readonly package: string;
	/** The version the source was taken from. */
	readonly version: string;
	/** The folder of the copy, relative to the site, with `/`. */
	readonly directory: string;
	readonly packageManager: "pnpm" | "yarn" | "bun" | "npm";
	/** What the dependency in `package.json` becomes. */
	readonly dependency: string;
	/** Files written or created (relative to the site). The copied source is one entry: its folder. */
	readonly created: readonly string[];
	/** Existing files that changed. */
	readonly updated: readonly string[];
	/** The changes to existing files, as diffs. */
	readonly diffs: readonly { readonly file: string; readonly diff: string }[];
	readonly installed: boolean;
	/** The command to run when the install was not run. */
	readonly installCommand?: string;
	/** What the person should know or do by hand. */
	readonly notes: readonly string[];
}

/** A JSON file's text with the same indent as the original (a tab when it has none to copy). */
function jsonText(original: string, value: unknown): string {
	const indent = /^([ \t]+)"/m.exec(original)?.[1] ?? "\t";
	return `${JSON.stringify(value, null, indent)}\n`;
}

type Json = Record<string, unknown>;

/** The folder of `node_modules/<name>` found from `from` upwards, as Node and the bundlers look it up. Symlinks (a workspace link) are followed. */
export function findInstalledPackage(from: string, name: string): string | undefined {
	for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
		const candidate = path.join(dir, "node_modules", name);
		if (existsSync(path.join(candidate, "package.json"))) return realpathSync(candidate);
		if (path.dirname(dir) === dir) return undefined;
	}
}

const isTestPath = (relative: string): boolean =>
	relative.split("/").includes("__test__") || relative === "src/test" || /\.test\.tsx?$/.test(relative);

/**
 * The files to copy, relative to the package folder, with where each goes. `src` and the files at the top of the package (README, `render.css`) go as they are;
 * the files `dist` holds that are not code (the built stylesheet and its fonts) go to `prebuilt/`, which no `.gitignore` ignores the way it does `dist`.
 */
export function filesToCopy(packageDir: string): { from: string; to: string }[] {
	const files: { from: string; to: string }[] = [];
	const walk = (relative: string, mapTo: (relative: string) => string | undefined) => {
		for (const entry of readdirSync(path.join(packageDir, relative), { withFileTypes: true })) {
			const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
			if (entry.isDirectory()) walk(child, mapTo);
			else {
				const to = mapTo(child);
				if (to !== undefined) files.push({ from: child, to });
			}
		}
	};
	for (const entry of readdirSync(packageDir, { withFileTypes: true })) {
		const name = entry.name;
		if (name === "node_modules" || name === "package.json" || name.startsWith(".")) continue;
		if (/^(?:vitest|tsconfig)[\w.-]*\.(?:json|ts)$/.test(name)) continue;
		if (entry.isDirectory()) {
			if (name === "src") walk("src", (file) => (isTestPath(file) ? undefined : file));
			else if (name === "dist") {
				walk("dist", (file) =>
					/\.(?:js|mjs|cjs|map|d\.ts|d\.mts|tsbuildinfo)$/.test(file) ? undefined : `prebuilt/${file.slice(5)}`,
				);
			} else if (name !== "styles" && name !== "scripts") walk(name, (file) => file);
		} else files.push({ from: name, to: name });
	}
	return files;
}

/** `./dist/x/y.js` → the source file that build made it from (`./src/x/y.ts` or `.tsx`). `undefined` when the package has no such source. */
function sourceOf(packageDir: string, target: string): string | undefined {
	const base = `./src/${target.slice("./dist/".length).replace(/\.js$/, "")}`;
	return [".ts", ".tsx"]
		.map((extension) => `${base}${extension}`)
		.find((file) => existsSync(path.join(packageDir, file)));
}

/**
 * The `exports` of the copy. A published package maps its entry points to `dist` (`publishConfig.exports` applied by `pack`); the copy maps them back to the
 * source file each was built from, and the built stylesheet to `prebuilt/`. Types need no entry: they are read from the source.
 */
export function sourceExports(packageDir: string, exportsField: unknown): Json {
	const out: Json = {};
	const retarget = (target: string): string => {
		if (!target.startsWith("./dist/")) return target;
		if (!target.endsWith(".js")) return `./prebuilt/${target.slice("./dist/".length)}`;
		const source = sourceOf(packageDir, target);
		if (!source) {
			throw new EjectError(
				`this version of the package was published without the source of ${target}. Install a version that ships its source (a release from after \`monti eject\` was added) and run the command again`,
			);
		}
		return source;
	};
	for (const [key, value] of Object.entries((exportsField ?? {}) as Json)) {
		if (typeof value === "string") out[key] = retarget(value);
		else {
			const conditions = Object.entries(value as Record<string, string>)
				.filter(([condition]) => condition !== "types")
				.map(([condition, target]) => [condition, retarget(target)] as const);
			const only = conditions.length === 1 && conditions[0]?.[0] === "default" ? conditions[0][1] : undefined;
			out[key] = only ?? Object.fromEntries(conditions);
		}
	}
	return out;
}

/** The `package.json` of the copy: the published one without what only publishing and the repo's own tests need. */
export function ejectedManifest(packageDir: string, manifest: Json): Json {
	const keep = [
		"name",
		"version",
		"private",
		"description",
		"license",
		"type",
		"cmsPlugin",
		"sideEffects",
		"dependencies",
		"peerDependencies",
		"peerDependenciesMeta",
		"optionalDependencies",
	];
	const out: Json = {};
	for (const key of keep) if (manifest[key] !== undefined) out[key] = manifest[key];
	// The copy is the site's, not something to publish.
	out.private = true;
	// The package manager installs the peer dependencies of a workspace package itself, from the registry, and not from the app's own `@monti-cms/*` (which may be a
	// bundle or a Git address the registry has never heard of; even an optional peer is looked up there). So the Monti peers are not declared as peers of the copy: it
	// imports them from the app's `node_modules`, as every installed Monti package does, and their ranges are kept under `montiPeerDependencies` for the record.
	const peers = (out.peerDependencies ?? {}) as Record<string, string>;
	const monti = Object.entries(peers).filter(([peer]) => peer.startsWith("@monti-cms/"));
	if (monti.length > 0) {
		out.peerDependencies = Object.fromEntries(
			Object.entries(peers).filter(([peer]) => !peer.startsWith("@monti-cms/")),
		);
		const meta = { ...((out.peerDependenciesMeta ?? {}) as Record<string, Json>) };
		for (const [peer] of monti) delete meta[peer];
		out.peerDependenciesMeta = meta;
		if (Object.keys(meta).length === 0) out.peerDependenciesMeta = undefined;
		if (Object.keys(out.peerDependencies as object).length === 0) out.peerDependencies = undefined;
		out.montiPeerDependencies = Object.fromEntries(monti);
	}
	// Where the keys go in `package.json`: `exports` after `type`.
	const ordered: Json = {};
	for (const [key, value] of Object.entries(out)) {
		ordered[key] = value;
		if (key === "type") ordered.exports = sourceExports(packageDir, manifest.exports);
	}
	if (!("exports" in ordered)) ordered.exports = sourceExports(packageDir, manifest.exports);
	return ordered;
}

const isYarnBerry = (cwd: string): boolean => {
	if (existsSync(path.join(cwd, ".yarnrc.yml"))) return true;
	try {
		const field = (JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as Json).packageManager;
		return typeof field === "string" && /^yarn@([2-9]|\d{2,})/.test(field);
	} catch {
		return false;
	}
};

/** What the site's dependency on the package becomes so that the package manager links the folder: the workspace protocol where the manager has it. */
export function workspaceSpec(manager: "pnpm" | "yarn" | "bun" | "npm", cwd: string): string {
	if (manager === "pnpm" || manager === "bun") return "workspace:*";
	if (manager === "yarn" && isYarnBerry(cwd)) return "workspace:*";
	// npm and yarn classic link a workspace package when the range matches its version.
	return "*";
}

/** `pnpm-workspace.yaml` text that lists the folder; `undefined` when it already does (or a glob covers it). */
export function withWorkspaceEntry(existing: string | undefined, directory: string): string | undefined {
	if (existing === undefined) return `packages:\n  - ${directory}\n`;
	const listed = existing.split(/\r?\n/).map((line) =>
		line
			.replace(/^\s*-\s*/, "")
			.replace(/\s+#.*$/, "")
			.replace(/^["']|["']$/g, "")
			.trim(),
	);
	const parent = directory.split("/").slice(0, -1).join("/");
	if (listed.includes(directory) || listed.includes(`${parent}/*`) || listed.includes(`${parent}/**`)) return undefined;
	if (/^packages:\s*\[\s*\]\s*(?:#.*)?$/m.test(existing)) {
		return existing.replace(/^packages:\s*\[\s*\]\s*(?:#.*)?$/m, `packages:\n  - ${directory}`);
	}
	if (/^packages:\s*(?:#.*)?$/m.test(existing)) {
		return existing.replace(/^packages:\s*(?:#.*)?$/m, (head) => `${head}\n  - ${directory}`);
	}
	return `packages:\n  - ${directory}\n${existing.startsWith("\n") ? "" : "\n"}${existing}`;
}

/** `.gitignore` text that keeps `.monti/ejected.json` out of the ignore of the `.monti/` folder (where `monti init` keeps local progress); `undefined` when nothing is needed. */
export function keepEjectedRecord(existing: string | undefined): string | undefined {
	if (existing === undefined) return undefined;
	const lines = existing.split(/\r?\n/);
	const ignored = lines.findIndex((line) => [".monti", ".monti/", "/.monti", "/.monti/"].includes(line.trim()));
	if (ignored === -1) return undefined;
	const next = [...lines];
	next.splice(ignored, 1, ".monti/*", "!.monti/ejected.json");
	return next.join("\n");
}

/** The install command for the manager. pnpm and npm are told not to refuse a lockfile that is about to change. */
function installFor(manager: "pnpm" | "yarn" | "bun" | "npm", cwd: string): InstallCommand {
	return { command: manager, args: manager === "pnpm" ? ["install", "--no-frozen-lockfile"] : ["install"], cwd };
}

const spawnInstall = (command: InstallCommand) => {
	const result = spawnSync(command.command, [...command.args], { cwd: command.cwd, stdio: "inherit" });
	if (result.error || result.status !== 0) {
		throw new EjectError(
			`\`${command.command} ${command.args.join(" ")}\` failed${result.error ? `: ${result.error.message}` : ""}. The files are in place; fix the install problem and run it again.`,
		);
	}
};

/** Ejects the package, or (with `dryRun`) says what it would do. */
export async function ejectPackage(options: EjectOptions): Promise<EjectReport> {
	const { cwd, name } = options;
	const dryRun = options.dryRun === true;

	const verdict = ejectability(name);
	if (!verdict.ok) throw new EjectError(verdict.reason);
	const spec: EjectablePackage = verdict.package;

	const sitePackagePath = path.join(cwd, "package.json");
	if (!existsSync(sitePackagePath)) {
		throw new EjectError(`No package.json in ${cwd}: run \`monti eject\` in the app's folder.`);
	}
	const siteText = readFileSync(sitePackagePath, "utf8");

	const already = readEjected(cwd).find((entry) => entry.package === name);
	if (already) {
		throw new EjectError(
			`${name} is already ejected (version ${already.version}, in ${already.directory}). To see what changed upstream since then: monti eject --diff ${name}`,
		);
	}

	const installedDir = findInstalledPackage(cwd, name);
	if (!installedDir) {
		throw new EjectError(
			`${name} is not installed here. Install it with your package manager first, then run \`monti eject ${name}\`.`,
		);
	}
	const manifest = JSON.parse(readFileSync(path.join(installedDir, "package.json"), "utf8")) as Json;
	const version = String(manifest.version);
	if (!existsSync(path.join(installedDir, "src"))) {
		throw new EjectError(
			`${name}@${version} was published without its source (it has no src folder). Install a version that ships its source and run the command again.`,
		);
	}

	const directory = `packages/${spec.directory}`;
	const target = path.join(cwd, directory);
	if (existsSync(target) && readdirSync(target).length > 0) {
		throw new EjectError(
			`${directory} already exists and is not empty. Move it away, or choose to keep it and do not eject.`,
		);
	}

	const manager = detectPackageManager(cwd);
	const dependency = workspaceSpec(manager, cwd);
	const files = filesToCopy(installedDir);
	const copiedManifest = ejectedManifest(installedDir, manifest);

	// ---- the edits to files the site owns ----
	const next = JSON.parse(siteText) as Json;
	const setIn = (section: string, value: string) => {
		const object = next[section] as Record<string, string> | undefined;
		if (object && name in object) object[name] = value;
		return Boolean(object && name in object);
	};
	const listed = ["dependencies", "devDependencies", "optionalDependencies"].map((section) =>
		setIn(section, dependency),
	);
	if (!listed.some(Boolean)) {
		next.dependencies = { ...(next.dependencies as Record<string, string> | undefined), [name]: dependency };
	}
	// An override that pins the package (a tarball, a version) would keep the other packages that need it on the installed copy.
	const pnpmOverrides = (next.pnpm as { overrides?: Record<string, string> } | undefined)?.overrides;
	if (pnpmOverrides && name in pnpmOverrides) pnpmOverrides[name] = dependency;
	for (const section of ["overrides", "resolutions"]) {
		const object = next[section] as Record<string, unknown> | undefined;
		if (object && typeof object[name] === "string") object[name] = dependency;
	}
	let workspaceFile: { file: string; before: string | undefined; after: string } | undefined;
	if (manager === "pnpm") {
		const file = "pnpm-workspace.yaml";
		const before = existsSync(path.join(cwd, file)) ? readFileSync(path.join(cwd, file), "utf8") : undefined;
		const after = withWorkspaceEntry(before, directory);
		if (after !== undefined) workspaceFile = { file, before, after };
	} else {
		const workspaces = next.workspaces as string[] | { packages?: string[] } | undefined;
		const entries = Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);
		const covered = entries.some((entry) => entry === directory || entry === "packages/*" || entry === "packages/**");
		if (!covered) {
			if (Array.isArray(workspaces) || workspaces === undefined) next.workspaces = [...entries, directory];
			else (next.workspaces as { packages?: string[] }).packages = [...entries, directory];
		}
	}
	const nextText = jsonText(siteText, next);

	const gitignoreBefore = existsSync(path.join(cwd, ".gitignore"))
		? readFileSync(path.join(cwd, ".gitignore"), "utf8")
		: undefined;
	const gitignoreAfter = keepEjectedRecord(gitignoreBefore);

	const record: EjectedPackage = {
		package: name,
		version,
		ejectedAt: (options.now?.() ?? new Date()).toISOString(),
		directory,
	};
	const records = [...readEjected(cwd), record];

	const updated = ["package.json"];
	const created = [directory, EJECTED_FILE];
	const diffs: { file: string; diff: string }[] = [
		{ file: "package.json", diff: unifiedDiff("package.json", siteText, nextText) },
	];
	if (workspaceFile) {
		(workspaceFile.before === undefined ? created : updated).push(workspaceFile.file);
		diffs.push({
			file: workspaceFile.file,
			diff: unifiedDiff(workspaceFile.file, workspaceFile.before ?? "", workspaceFile.after),
		});
	}
	if (gitignoreAfter !== undefined && gitignoreBefore !== undefined) {
		updated.push(".gitignore");
		diffs.push({ file: ".gitignore", diff: unifiedDiff(".gitignore", gitignoreBefore, gitignoreAfter) });
	}

	const installCommand = installFor(manager, cwd);
	const installLine = `${installCommand.command} ${installCommand.args.join(" ")}`;
	const notes = [
		`Updates for ${name} are now the site's job. \`${manager === "npm" ? "npm update" : `${manager} up`}\` no longer changes it, and new Monti releases do not touch ${directory}.`,
		`To see what changed upstream since ${version}: monti eject --diff ${name}`,
		"Core, auth, storage and the write pipeline are still installed packages and keep receiving upgrades.",
	];
	if (spec.name === "@monti-cms/admin") {
		notes.push(
			`The admin stylesheet is the prebuilt one (${directory}/prebuilt/styles.css). New Tailwind classes in the ejected source are not in it: put their rules in your own CSS.`,
		);
	}

	const base = {
		package: name,
		version,
		directory,
		packageManager: manager,
		dependency,
		created,
		updated,
		diffs,
		notes,
	} as const;
	if (dryRun) return { ...base, dryRun: true, installed: false, installCommand: installLine };

	if (!options.yes) {
		if (!options.prompter) {
			throw new EjectError(
				`Ejecting ${name} hands its updates over to the site, so it needs a yes: run it in a terminal to be asked, or pass --yes. \`--dry-run\` shows what would change.`,
			);
		}
		options.prompter.note(diffs.map((entry) => entry.diff).join("\n\n"), "Changes to your files");
		const agreed = await options.prompter.confirm({
			message: `Copy ${name}@${version} into ${directory}? Its updates become your job.`,
			initial: false,
		});
		if (!agreed) throw new EjectError("Cancelled: nothing was changed.");
	}

	// ---- write ----
	for (const file of files) {
		const to = path.join(target, file.to);
		mkdirSync(path.dirname(to), { recursive: true });
		writeFileSync(to, readFileSync(path.join(installedDir, file.from)));
	}
	writeFileSync(path.join(target, "package.json"), jsonText("", copiedManifest));
	writeFileSync(sitePackagePath, nextText);
	if (workspaceFile) writeFileSync(path.join(cwd, workspaceFile.file), workspaceFile.after);
	mkdirSync(path.join(cwd, ".monti"), { recursive: true });
	writeFileSync(path.join(cwd, EJECTED_FILE), ejectedText(records));
	if (gitignoreAfter !== undefined) writeFileSync(path.join(cwd, ".gitignore"), gitignoreAfter);

	if (options.install === false) return { ...base, dryRun: false, installed: false, installCommand: installLine };
	await (options.runInstall ?? spawnInstall)(installCommand);
	return { ...base, dryRun: false, installed: true };
}

/** The report as lines for a terminal. */
export function formatEjectReport(report: EjectReport): string {
	const lines: string[] = [];
	const verb = report.dryRun ? "Would eject" : "Ejected";
	lines.push(
		`${verb} ${report.package}@${report.version} into ${report.directory}/ (source copied from the installed package).`,
	);
	lines.push("");
	lines.push(report.dryRun ? "Would write:" : "Wrote:");
	for (const file of report.created) lines.push(`  ${file}`);
	lines.push(report.dryRun ? "Would change:" : "Changed:");
	for (const file of report.updated) lines.push(`  ${file}`);
	lines.push(`  (the dependency on ${report.package} is now "${report.dependency}": the app builds the copy)`);
	if (report.dryRun) {
		for (const entry of report.diffs) lines.push("", entry.diff);
		lines.push("", "Nothing was changed (--dry-run).");
	}
	if (!report.dryRun && !report.installed && report.installCommand) {
		lines.push("", `Run \`${report.installCommand}\` to link the copy.`);
	}
	lines.push("");
	for (const note of report.notes) lines.push(`- ${note}`);
	return lines.join("\n");
}
