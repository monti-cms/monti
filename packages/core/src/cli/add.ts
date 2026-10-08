import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseJsonc } from "./config-paths";
import { setupThemeStyles, type ThemeStylesResult } from "./first-run";
import type { Prompter } from "./init-prompts";
import { INIT_PROXY_TEMPLATE } from "./proxy-template";
import {
	defaultRegistrySource,
	describeSource,
	type FetchLike,
	parseRegistrySource,
	type RegistryFile,
	type RegistryItem,
	resolveItems,
} from "./registry";
import { applyBlogThemeSettings, type BlogThemeSettings, blogThemeSettings } from "./theme-settings";

/**
 * `monti add <name...>`: copies components from a registry into the host app as source it owns, rewrites the registry's own import alias to the host's,
 * and installs the npm packages they need.
 */

/** Alias components are installed under when the host names none (`components.json` `aliases.components`). */
export const DEFAULT_COMPONENTS_ALIAS = "@/components";
/** The folder under the components alias, and the import prefix registry items use for each other (`@/registry/monti/<item>/<file>`). */
const INSTALL_FOLDER = "monti";

export interface InstallCommand {
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd: string;
}

export interface AddOptions {
	readonly cwd: string;
	/** The components to install. */
	readonly names: readonly string[];
	/** `--registry`: a folder or URL holding `registry.json` and the item files. Default: the registry shipped inside the installed `@monti-cms/core`, so the components match the packages the app has. */
	readonly registry?: string;
	/** Replace files that differ from the registry. Without it such a file stops the whole install and nothing is written. */
	readonly overwrite?: boolean;
	/** Only report what would be written and installed. */
	readonly dryRun?: boolean;
	/** For a registry URL. Default: global `fetch`. */
	readonly fetch?: FetchLike;
	/** Runs the package manager. Default: spawns it with the terminal attached. A non-zero exit is an error. */
	readonly install?: (command: InstallCommand) => void | Promise<void>;
	/** Confirms the change to the global CSS that the theme components need (after showing its diff). Without it, and without `yes`, the lines are printed instead. */
	readonly prompter?: Pick<Prompter, "note" | "confirm">;
	/** Make that change to the global CSS without asking. */
	readonly yes?: boolean;
	/** The blocks package is used, so its `render.css` is wanted too. Default: looked up in `package.json` and `monti.config.ts`. */
	readonly blocks?: boolean;
}

export interface AddReport {
	readonly dryRun: boolean;
	readonly registry: string;
	/** Everything that was resolved, in install order: the requested components and what they need. */
	readonly items: readonly string[];
	/** Files written for the first time (relative to `cwd`). */
	readonly created: readonly string[];
	/** Files replaced (only with `overwrite`). */
	readonly overwritten: readonly string[];
	/** Files that already hold exactly this content. */
	readonly unchanged: readonly string[];
	/** Files that differ and were not replaced because `overwrite` is off. When this is not empty, nothing was written. */
	readonly conflicts: readonly string[];
	/** npm packages installed (or to install, on a dry run). Those the app already lists are left out. */
	readonly dependencies: readonly string[];
	readonly devDependencies: readonly string[];
	/** The alias the components are imported from, e.g. `@/components/monti`. */
	readonly importAlias: string;
	/** Things to do by hand. */
	readonly manual: readonly string[];
	/** The check of the global CSS (typography plugin, `render.css` imports), for components that draw article text. */
	readonly styles?: ThemeStylesResult;
	/** What `monti add` filled in from the app's own schema (the blog theme: collection, route base, field names), as lines for the report. */
	readonly configured: readonly string[];
}

/** Components whose markup uses the `prose` classes and the code and block styles of `render.css`: the global CSS has to load them. */
const STYLED_ITEMS = ["article-body", "blog-theme"];

interface TsconfigLike {
	readonly compilerOptions?: {
		readonly baseUrl?: string;
		readonly paths?: Readonly<Record<string, readonly string[]>>;
	};
}

const readJsonc = <T>(file: string): T | undefined =>
	existsSync(file) ? (parseJsonc(readFileSync(file, "utf8")) as T | undefined) : undefined;

/** The alias of the components folder: `aliases.components` of `components.json` (shadcn's file), else {@link DEFAULT_COMPONENTS_ALIAS}. */
function componentsAlias(cwd: string): string {
	const config = readJsonc<{ aliases?: { components?: unknown } }>(path.join(cwd, "components.json"));
	const alias = config?.aliases?.components;
	return typeof alias === "string" && alias.length > 0 ? alias.replace(/\/+$/, "") : DEFAULT_COMPONENTS_ALIAS;
}

/**
 * The folder an import alias points to, by the tsconfig `paths` (the longest matching pattern wins). Without a matching pattern an alias of the form
 * `@/x` or `~/x` is taken to start at `src/` when the app has one, else at the app folder, and `mapped` is false so the caller can say how to wire it.
 */
function aliasFolder(cwd: string, alias: string): { dir: string; mapped: boolean } {
	for (const name of ["tsconfig.json", "jsconfig.json"]) {
		const config = readJsonc<TsconfigLike>(path.join(cwd, name));
		const paths = config?.compilerOptions?.paths;
		if (!paths) continue;
		const base = path.resolve(cwd, config?.compilerOptions?.baseUrl ?? ".");
		let best: { prefixLength: number; dir: string } | undefined;
		for (const [pattern, targets] of Object.entries(paths)) {
			const target = targets[0];
			if (!target) continue;
			const star = pattern.indexOf("*");
			const prefix = star === -1 ? pattern : pattern.slice(0, star);
			// `@/components/*` also covers the alias `@/components` itself.
			const probe = star === -1 ? alias : `${alias}/`;
			const matches = star === -1 ? alias === pattern : probe.startsWith(prefix);
			if (!matches || (best && prefix.length <= best.prefixLength)) continue;
			const rest = star === -1 ? "" : probe.slice(prefix.length).replace(/\/$/, "");
			best = { prefixLength: prefix.length, dir: path.resolve(base, target.replace("*", rest)) };
		}
		if (best) return { dir: best.dir, mapped: true };
	}
	const match = /^[@~]\/(.*)$/.exec(alias);
	if (!match)
		throw new Error(
			`Cannot find the folder of the alias "${alias}": add it to compilerOptions.paths in tsconfig.json.`,
		);
	return { dir: path.join(cwd, existsSync(path.join(cwd, "src")) ? "src" : "", match[1] ?? ""), mapped: false };
}

/** Whether `next.config` turns on Next's `cacheComponents`. */
function usesCacheComponents(cwd: string): boolean {
	for (const name of ["next.config.ts", "next.config.mjs", "next.config.js"]) {
		const file = path.join(cwd, name);
		if (existsSync(file)) return /\bcacheComponents\s*:\s*true\b/.test(readFileSync(file, "utf8"));
	}
	return false;
}

/**
 * A line a registry file marks with `// monti:cache-components` (an `export const instant = false;`, only valid with that option) is kept, without its marker, when
 * the app turns `cacheComponents` on, and dropped (with the comment lines right above it) when it does not.
 */
export function applyCacheComponentsMarker(source: string, enabled: boolean): string {
	const marked = /(?:^\/\/[^\n]*\n)*^([^\n]*?)[ \t]*\/\/ monti:cache-components[^\n]*\n?/gm;
	return source.replace(marked, (whole, line: string) =>
		enabled ? `${whole.slice(0, whole.indexOf(line))}${line}\n` : "",
	);
}

/** Turns the registry's own import prefix into the host's alias. Only quoted specifiers (`from "..."`, `import("...")`). */
export const rewriteRegistryImports = (source: string, installAlias: string): string =>
	source.replace(/(["'])@\/registry\/monti\//g, (_, quote: string) => `${quote}${installAlias}/`);

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

/**
 * Fills the placeholders of a `target`. `{app}` is the folder of the Next App Router: `src/app` when the app has one (or has `src/` and no `app/`), else `app`.
 * `{routeBase}` is the address the posts live at, without the slashes around it (`blog`, from the `path` of the collection in `monti.schema.json`); the caller
 * that read the schema passes it. Any other `{name}` is an error, so a typo does not create a folder called `{name}`.
 */
export function resolveTargetPlaceholders(cwd: string, target: string, routeBase?: string): string {
	return target.replace(/\{([^{}/]*)\}/g, (_, name: string) => {
		if (name === "routeBase" && routeBase !== undefined) return routeBase.replace(/^\/+|\/+$/g, "");
		if (name !== "app") {
			throw new Error(
				`Unknown placeholder {${name}} in the target "${target}". Known: {app}${routeBase === undefined ? "" : ", {routeBase}"}.`,
			);
		}
		if (existsSync(path.join(cwd, "src/app"))) return "src/app";
		return existsSync(path.join(cwd, "src")) && !existsSync(path.join(cwd, "app")) ? "src/app" : "app";
	});
}

/** Where a file goes: its `target` (relative to the app folder, `~/` and `{app}` allowed), else under the install folder in the components alias. */
function destinationOf(
	cwd: string,
	componentsDir: string,
	item: RegistryItem,
	file: RegistryFile,
	routeBase: string | undefined,
): string {
	let relative: string;
	if (file.target) {
		relative = resolveTargetPlaceholders(cwd, file.target, routeBase).replace(/^~\//, "");
	} else {
		const own = `items/${item.name}/`;
		const inside = file.path.replace(/^\.\//, "");
		relative = path.join(
			componentsDir,
			INSTALL_FOLDER,
			item.name,
			inside.startsWith(own) ? inside.slice(own.length) : inside,
		);
	}
	const absolute = path.resolve(cwd, relative);
	if (path.relative(cwd, absolute).startsWith("..") || path.isAbsolute(path.relative(cwd, absolute)))
		throw new Error(`${item.name}: ${file.path} would be written outside the app (${relative}).`);
	return absolute;
}

/** `name@range` to `name` (scoped names keep their `@`). */
const packageName = (spec: string) => (spec.lastIndexOf("@") > 0 ? spec.slice(0, spec.lastIndexOf("@")) : spec);

/** The package manager of the app, by its lockfile, then its `packageManager` field; `npm` when neither says. */
export function detectPackageManager(cwd: string): "pnpm" | "yarn" | "bun" | "npm" {
	const lockfiles = [
		["pnpm-lock.yaml", "pnpm"],
		["yarn.lock", "yarn"],
		["bun.lock", "bun"],
		["bun.lockb", "bun"],
		["package-lock.json", "npm"],
	] as const;
	for (const [file, manager] of lockfiles) if (existsSync(path.join(cwd, file))) return manager;
	const field = readJsonc<{ packageManager?: unknown }>(path.join(cwd, "package.json"))?.packageManager;
	const named = typeof field === "string" ? field.split("@")[0] : undefined;
	return named === "pnpm" || named === "yarn" || named === "bun" ? named : "npm";
}

function installCommand(cwd: string, packages: readonly string[], dev: boolean): InstallCommand {
	const manager = detectPackageManager(cwd);
	const verb = manager === "npm" ? "install" : "add";
	return { command: manager, args: [verb, ...(dev ? ["-D"] : []), ...packages], cwd };
}

const runInstall = (command: InstallCommand) => {
	const result = spawnSync(command.command, [...command.args], { cwd: command.cwd, stdio: "inherit" });
	if (result.error || result.status !== 0)
		throw new Error(
			`\`${command.command} ${command.args.join(" ")}\` failed${result.error ? `: ${result.error.message}` : ""}.`,
		);
};

const unique = <T>(values: readonly T[]) => [...new Set(values)];

/**
 * Installs the components (and the components they need) into the app in `cwd`. Every file is checked first: a file that differs from the registry's
 * stops the install, with nothing written, unless `overwrite` is set. Files that already match are left alone, so running it again changes nothing.
 */
export async function addComponents(options: AddOptions): Promise<AddReport> {
	const { cwd } = options;
	if (options.names.length === 0) throw new Error("Name the components to add: monti add <name...>");
	const packageFile = path.join(cwd, "package.json");
	if (!existsSync(packageFile)) throw new Error(`No package.json in ${cwd}: run \`monti add\` in the app's folder.`);
	const fetchFn = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
	const source = options.registry ? parseRegistrySource(options.registry, cwd) : defaultRegistrySource();
	const items = await resolveItems(source, options.names, fetchFn);

	// The blog theme is a set of pages that must agree with the schema, so the schema shapes it: the route folders follow the `path` of the collection, and
	// theme.config.ts gets the collection and the names of the summary, tags and author fields the schema has.
	const theme: BlogThemeSettings | undefined = items.some((item) => item.name === "blog-theme")
		? blogThemeSettings(cwd)
		: undefined;

	const alias = componentsAlias(cwd);
	const folder = aliasFolder(cwd, alias);
	const installAlias = `${alias}/${INSTALL_FOLDER}`;

	const cacheComponents = usesCacheComponents(cwd);
	const created: string[] = [];
	const overwritten: string[] = [];
	const unchanged: string[] = [];
	const conflicts: string[] = [];
	const writes: { absolute: string; content: string }[] = [];
	for (const item of items) {
		for (const file of item.files) {
			if (file.content === undefined)
				throw new Error(`${item.name}: ${file.path} has no content in the registry item.`);
			const absolute = destinationOf(cwd, folder.dir, item, file, theme?.routeBase);
			let content = SOURCE_FILE.test(file.path)
				? applyCacheComponentsMarker(rewriteRegistryImports(file.content, installAlias), cacheComponents)
				: file.content;
			if (theme && item.name === "blog-theme" && path.basename(file.path) === "theme.config.ts")
				content = applyBlogThemeSettings(content, theme);
			const relative = path.relative(cwd, absolute).split(path.sep).join("/");
			if (!existsSync(absolute)) {
				created.push(relative);
				writes.push({ absolute, content });
			} else if (readFileSync(absolute, "utf8") === content) {
				unchanged.push(relative);
			} else if (
				options.overwrite ||
				(/(^|\/)proxy\.ts$/.test(relative) && readFileSync(absolute, "utf8") === INIT_PROXY_TEMPLATE)
			) {
				// `monti init` wrote this proxy.ts, and the theme's proxy does the same and more: it is replaced without asking.
				overwritten.push(relative);
				writes.push({ absolute, content });
			} else {
				conflicts.push(relative);
			}
		}
	}

	const host = readJsonc<{
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
	}>(packageFile);
	const known = new Set([
		...Object.keys(host?.dependencies ?? {}),
		...Object.keys(host?.devDependencies ?? {}),
		...Object.keys(host?.peerDependencies ?? {}),
	]);
	const missing = (specs: readonly (string[] | undefined)[]) =>
		unique(specs.flatMap((list) => list ?? [])).filter((spec) => !known.has(packageName(spec)));
	const dependencies = missing(items.map((item) => item.dependencies));
	const devDependencies = missing(items.map((item) => item.devDependencies)).filter(
		(spec) => !dependencies.includes(spec),
	);

	const manual: string[] = [];
	if (!folder.mapped && writes.some((write) => SOURCE_FILE.test(write.absolute)))
		manual.push(
			`Add the alias to compilerOptions.paths in tsconfig.json so the installed imports resolve: "${alias.split("/")[0]}/*": ["./${existsSync(path.join(cwd, "src")) ? "src/" : ""}*"]`,
		);

	manual.push(...(theme?.notes ?? []));

	const report: AddReport = {
		dryRun: Boolean(options.dryRun),
		registry: describeSource(source),
		items: items.map((item) => item.name),
		created,
		overwritten,
		unchanged,
		conflicts,
		dependencies,
		devDependencies,
		importAlias: installAlias,
		manual,
		configured: theme ? [`theme.config.ts from ${theme.summary}`] : [],
	};
	const styled = items.some((item) => STYLED_ITEMS.includes(item.name));
	const installStyles = (dryRun: boolean) =>
		setupThemeStyles({
			cwd,
			blocks: options.blocks,
			installCommand: commandText(installCommand(cwd, ["@tailwindcss/typography"], true)),
			prompter: options.prompter,
			yes: options.yes,
			dryRun,
		});
	if (options.dryRun && conflicts.length === 0 && styled) {
		const styles = await installStyles(true);
		return { ...report, styles, manual: [...manual, ...styles.manual] };
	}
	if (options.dryRun || conflicts.length > 0) return report;

	for (const write of writes) {
		mkdirSync(path.dirname(write.absolute), { recursive: true });
		writeFileSync(write.absolute, write.content);
	}
	const install = options.install ?? runInstall;
	if (dependencies.length > 0) await install(installCommand(cwd, dependencies, false));
	if (devDependencies.length > 0) await install(installCommand(cwd, devDependencies, true));
	if (!styled) return report;
	const styles = await installStyles(false);
	if (styles.installDevDependency) await install(installCommand(cwd, [styles.installDevDependency], true));
	return { ...report, styles, manual: [...manual, ...styles.manual] };
}

const commandText = (command: InstallCommand) => `${command.command} ${command.args.join(" ")}`;

/** The report as lines for the terminal. */
export function formatAddReport(report: AddReport): string {
	const lines: string[] = [];
	const section = (title: string, files: readonly string[]) => {
		if (files.length > 0) lines.push(`${title}:`, ...files.map((file) => `  ${file}`));
	};
	const dry = report.dryRun ? " (dry run: nothing written)" : "";
	lines.push(`registry: ${report.registry}${dry}`, `components: ${report.items.join(", ")}`);
	section(report.dryRun ? "would create" : "created", report.created);
	section(report.dryRun ? "would overwrite" : "overwritten", report.overwritten);
	section("unchanged", report.unchanged);
	if (report.conflicts.length > 0) {
		lines.push(
			"These files differ from the registry and were not touched (nothing was written):",
			...report.conflicts.map((file) => `  ${file}`),
			"Run again with --overwrite to replace them, or keep your version and skip the component.",
		);
	}
	if (report.dependencies.length > 0)
		lines.push(`${report.dryRun ? "would install" : "installed"}: ${report.dependencies.join(", ")}`);
	if (report.devDependencies.length > 0)
		lines.push(`${report.dryRun ? "would install (dev)" : "installed (dev)"}: ${report.devDependencies.join(", ")}`);
	if (report.conflicts.length === 0 && report.created.length + report.overwritten.length > 0)
		lines.push(`import from ${report.importAlias}/<component>/<file>`);
	for (const line of report.configured) lines.push(`configured: ${line}`);
	if (report.styles?.diff) {
		lines.push(
			`${report.dryRun ? "would change" : "changed"} ${report.styles.diff.file}:`,
			...report.styles.diff.diff.split("\n").map((line) => `  ${line}`),
		);
	}
	for (const note of report.manual) lines.push(`manual step: ${note}`);
	return lines.join("\n");
}
