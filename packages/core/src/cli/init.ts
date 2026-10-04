import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_ADMIN_PATH, isAdminPath } from "../config/define";
import { CONFIG_ALIAS, parseJsonc, SERVER_ALIAS } from "./config-paths";
import {
	ADMIN_LAYOUT_TEMPLATE,
	ADMIN_PAGE_TEMPLATE,
	API_ROUTE_TEMPLATE,
	CSS_LINES,
	configTemplate,
	DEFAULT_INIT_LOCALE,
	DEFAULT_INIT_TIME_ZONE,
	ENV_VARS,
	INSTALL_COMMANDS,
	nextConfigTemplate,
	SERVER_TEMPLATE,
} from "./templates";

export interface InitOptions {
	/** Next app folder (where `package.json` is). */
	readonly cwd: string;
	/** Admin UI path (default `/admin`). If different, set `admin.path` in the site config and create the route folder at that path too. */
	readonly adminPath?: string;
	/** Site default locale code (default `en`). The admin UI locale and date formatting follow it. */
	readonly locale?: string;
	/** Date/time zone (IANA, default `UTC`). */
	readonly timeZone?: string;
}

export interface InitReport {
	/** Newly created files (relative to `cwd`). */
	readonly created: string[];
	/** Files that already existed and were left as they are. Never overwritten. */
	readonly skipped: string[];
	/** Modified files (tsconfig `paths`, global CSS, next config). */
	readonly updated: string[];
	/** Manual steps (what could not be fixed automatically, installation, environment variables, next steps). */
	readonly todo: string[];
}

/** Whether this is an IANA time zone name. */
function isTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
}

/** Joins paths with `/` (reports and config values are the same regardless of the operating system). */
const posix = (file: string) => file.split(path.sep).join("/");
const dotted = (file: string) => (file.startsWith(".") ? file : `./${file}`);

const CSS_CANDIDATES = ["app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css"];
const NEXT_CONFIGS = ["next.config.ts", "next.config.mjs", "next.config.js"];

/**
 * `monti init`: creates the files that attach the CMS to a Next app. **Existing files are not overwritten**; they are reported as skipped.
 * Creates: site and server config, admin routes (page and layout), admin API route (including login).
 * Modifies (only when safe): tsconfig `paths`, the style line in global CSS, a next config of the default shape. If it cannot, it reports a manual step.
 */
export function initProject(options: InitOptions): InitReport {
	const { cwd } = options;
	const adminPath = options.adminPath ?? DEFAULT_ADMIN_PATH;
	const locale = options.locale ?? DEFAULT_INIT_LOCALE;
	const timeZone = options.timeZone ?? DEFAULT_INIT_TIME_ZONE;
	if (!/^[a-z]{2,3}$/.test(locale)) {
		throw new Error(`--locale "${locale}" must be a lower-case language code like "en" or "ko"`);
	}
	if (!isTimeZone(timeZone)) {
		throw new Error(`--time-zone "${timeZone}" must be an IANA time zone like "UTC" or "Asia/Seoul"`);
	}
	if (!isAdminPath(adminPath)) {
		throw new Error(`--admin-path "${adminPath}" must be a path like "/admin" (not "/" and not under "/api")`);
	}
	if (!existsSync(path.join(cwd, "package.json"))) {
		throw new Error("package.json not found; run `monti init` in the Next app folder");
	}

	const report: InitReport = { created: [], skipped: [], updated: [], todo: [] };
	const exists = (file: string) => existsSync(path.join(cwd, file));
	const read = (file: string) => readFileSync(path.join(cwd, file), "utf8");
	const write = (file: string, content: string) => {
		mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
		writeFileSync(path.join(cwd, file), content);
	};
	const create = (file: string, content: string) => {
		if (exists(file)) report.skipped.push(posix(file));
		else {
			write(file, content);
			report.created.push(posix(file));
		}
	};

	// Apps that use `src/app` keep the config files in `src/` too.
	const useSrc = exists("src/app");
	const appDir = useSrc ? "src/app" : "app";
	const configFile = useSrc ? "src/cms.config.ts" : "cms.config.ts";
	const serverFile = useSrc ? "src/cms.server.ts" : "cms.server.ts";
	if (!exists(appDir))
		report.todo.push(
			`The App Router folder (${appDir}) did not exist, so it was created. Check that this is a Next App Router app.`,
		);

	const hadConfig = exists(configFile);
	create(configFile, configTemplate(adminPath, { locale, timeZone }));
	if (hadConfig && adminPath !== DEFAULT_ADMIN_PATH && !read(configFile).includes(adminPath)) {
		report.todo.push(`Add admin: { path: "${adminPath}" } to ${configFile} (it must match the admin route folder).`);
	}
	create(serverFile, SERVER_TEMPLATE);
	const adminDir = posix(path.join(appDir, "(admin)", ...adminPath.split("/").filter(Boolean), "[[...path]]"));
	create(`${adminDir}/page.tsx`, ADMIN_PAGE_TEMPLATE);
	create(
		posix(path.join(appDir, "(admin)", ...adminPath.split("/").filter(Boolean), "layout.tsx")),
		ADMIN_LAYOUT_TEMPLATE,
	);
	create(`${appDir}/api/cms/[...path]/route.ts`, API_ROUTE_TEMPLATE);

	addTsconfigPaths(cwd, { [CONFIG_ALIAS]: configFile, [SERVER_ALIAS]: serverFile }, report);
	addCssLines(cwd, report);
	addWithCms(cwd, dotted(configFile), dotted(serverFile), report);

	report.todo.push(
		`Install packages: ${INSTALL_COMMANDS.join(" && ")}`,
		["Values for .env.local:", ...ENV_VARS.map((env) => `  ${env.name.padEnd(20)} ${env.note}`)].join("\n"),
		"GitHub OAuth app callback URL: <site URL>/api/cms/auth/callback/github",
		`Edit the collections in ${configFile}, run \`monti migrate\` to create the database tables, then open ${adminPath} in next dev.`,
	);
	return report;
}

/** Adds the config aliases to tsconfig `paths`. Only edits JSON without comments, and leaves existing aliases as they are. */
function addTsconfigPaths(cwd: string, aliases: Readonly<Record<string, string>>, report: InitReport): void {
	const file = path.join(cwd, "tsconfig.json");
	const manual = () =>
		`Add ${Object.entries(aliases)
			.map(([alias, target]) => `"${alias}": ["${dotted(target)}"]`)
			.join(", ")} to compilerOptions.paths in tsconfig.json.`;
	if (!existsSync(file)) {
		report.todo.push(manual());
		return;
	}
	const text = readFileSync(file, "utf8");
	let json: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
	try {
		json = JSON.parse(text);
	} catch {
		// With comments or trailing commas, rewriting would drop them, so leave the file alone.
		const parsed = parseJsonc(text) as typeof json | undefined;
		const paths = parsed?.compilerOptions?.paths ?? {};
		if (Object.keys(aliases).every((alias) => paths[alias])) report.skipped.push("tsconfig.json");
		else report.todo.push(manual());
		return;
	}
	json.compilerOptions ??= {};
	json.compilerOptions.paths ??= {};
	const base = path.resolve(cwd, json.compilerOptions.baseUrl ?? ".");
	let changed = false;
	for (const [alias, target] of Object.entries(aliases)) {
		if (json.compilerOptions.paths[alias]) continue;
		json.compilerOptions.paths[alias] = [dotted(posix(path.relative(base, path.join(cwd, target))))];
		changed = true;
	}
	if (!changed) {
		report.skipped.push("tsconfig.json");
		return;
	}
	const indent = /^\{\r?\n(\s+)/.exec(text)?.[1] ?? "\t";
	// Keep single-value arrays (`["./x"]`) on one line (the shape of a tsconfig created by Next).
	const out = JSON.stringify(json, null, indent).replace(/\[\s*("(?:[^"\\]|\\.)*")\s*\]/g, "[$1]");
	writeFileSync(file, `${out}\n`);
	report.updated.push("tsconfig.json");
}

/** Adds the admin style line to global CSS (the Tailwind entry). Inserts it after the last `@import` and skips lines that already exist. */
function addCssLines(cwd: string, report: InitReport): void {
	const file = CSS_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
	const manual = `Add these lines to the global CSS (the Tailwind input) after @import "tailwindcss";: ${CSS_LINES.join(" ")}`;
	if (!file) {
		report.todo.push(manual);
		return;
	}
	const text = readFileSync(path.join(cwd, file), "utf8");
	if (!/@import\s+["']tailwindcss["']/.test(text)) {
		report.todo.push(`${file} has no Tailwind CSS 4 (@import "tailwindcss";). Install Tailwind 4, then: ${manual}`);
		return;
	}
	const missing = CSS_LINES.filter((line) => !text.includes(line.replace(/;$/, "")));
	if (missing.length === 0) {
		report.skipped.push(file);
		return;
	}
	const lines = text.split("\n");
	let last = -1;
	lines.forEach((line, index) => {
		if (/^@import\s/.test(line.trim())) last = index;
	});
	lines.splice(last + 1, 0, "/* @monti-cms/core admin screen */", ...missing);
	writeFileSync(path.join(cwd, file), lines.join("\n"));
	report.updated.push(file);
}

/** Wraps the next config with `withCms`. Only edits the default shape (a single `export default nextConfig;` line), and creates one if missing. */
function addWithCms(cwd: string, config: string, server: string, report: InitReport): void {
	const file = NEXT_CONFIGS.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (!file) {
		writeFileSync(path.join(cwd, "next.config.ts"), nextConfigTemplate(config, server));
		report.created.push("next.config.ts");
		return;
	}
	const text = readFileSync(path.join(cwd, file), "utf8");
	if (text.includes("withCms")) {
		report.skipped.push(file);
		return;
	}
	const exportLine = /^export default nextConfig;?[ \t]*$/m;
	const exports = text.match(new RegExp(exportLine.source, "gm")) ?? [];
	if (exports.length !== 1) {
		report.todo.push(
			`Wrap the config in ${file}: import { withCms } from "@monti-cms/core/next"; export default withCms(nextConfig, { config: "${config}", server: "${server}" });`,
		);
		return;
	}
	const importLine = 'import { withCms } from "@monti-cms/core/next";\n';
	const replaced = text.replace(
		exportLine,
		`export default withCms(nextConfig, { config: "${config}", server: "${server}" });`,
	);
	writeFileSync(path.join(cwd, file), `${importLine}${replaced}`);
	report.updated.push(file);
}

/** Turns the report into human-readable text. */
export function formatInitReport(report: InitReport): string {
	const section = (title: string, items: readonly string[]) =>
		items.length === 0 ? [] : [title, ...items.map((item) => `  - ${item.replaceAll("\n", "\n    ")}`), ""];
	return [
		...section("Created:", report.created),
		...section("Updated:", report.updated),
		...section("Skipped (already exist, not overwritten):", report.skipped),
		...section("To do:", report.todo),
	]
		.join("\n")
		.trimEnd();
}
