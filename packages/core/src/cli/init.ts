import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_ADMIN_PATH, isAdminPath } from "../config/define";
import { parseJsonc } from "./config-paths";
import { generateSchemaTypes, SCHEMA_TYPES_FILE } from "./schema-types";
import {
	adminLayoutTemplate,
	adminPageTemplate,
	apiRouteTemplate,
	DEFAULT_INIT_LOCALE,
	DEFAULT_INIT_TIME_ZONE,
	ENV_VARS,
	INSTALL_COMMANDS,
	MONTI_CONFIG_TEMPLATE,
	nextConfigTemplate,
	schemaTemplate,
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
	/** Modified files (the next config). */
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
/** The JSON Schema of the core package, as a path from the schema file (a schema file in `src/` reaches `node_modules` one folder up). */
const linkFrom = (schemaFile: string) =>
	dotted(posix(path.join(path.relative(path.dirname(schemaFile), "."), "node_modules/@monti-cms/core/schema.json")));

const NEXT_CONFIGS = ["next.config.ts", "next.config.mjs", "next.config.js"];

/**
 * `monti init`: creates the files that attach the CMS to a Next app. **Existing files are not overwritten**; they are reported as skipped.
 * Creates: `monti.config.ts` (the one config, which makes the CMS instance), its schema file, the admin screens (a layout and a catch-all page; the layout imports
 * the prebuilt admin stylesheet) and the admin API route (including login): three Next files.
 * Modifies (only when safe): a next config of the default shape. If it cannot, it reports a manual step.
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

	// Apps that use `src/app` keep the config file in `src/` too.
	const useSrc = exists("src/app");
	const appDir = useSrc ? "src/app" : "app";
	const configFile = useSrc ? "src/monti.config.ts" : "monti.config.ts";
	if (!exists(appDir))
		report.todo.push(
			`The App Router folder (${appDir}) did not exist, so it was created. Check that this is a Next App Router app.`,
		);

	const hadConfig = exists(configFile);
	// The two files of the earlier setup (the site config and the server file) are the one config file now.
	const legacy = ["cms.config.ts", "cms.server.ts"].map((file) => (useSrc ? `src/${file}` : file)).filter(exists);
	if (legacy.length > 0 && !hadConfig) {
		report.todo.push(
			`${legacy.join(" and ")} from the earlier setup ${legacy.length > 1 ? "are" : "is"} replaced by ${configFile}: no ${configFile} was created, so move them into it (see "Upgrading" in the core README), then run \`monti schema:extract\` if the collections are written in code.`,
		);
	} else {
		create(configFile, MONTI_CONFIG_TEMPLATE);
	}
	const schemaFile = posix(path.join(path.dirname(configFile), "monti.schema.json"));
	const typesFile = posix(path.join(path.dirname(configFile), SCHEMA_TYPES_FILE));
	if (hadConfig || legacy.length > 0) {
		// An existing config is the site's own: it is not given a schema file it does not load.
		if (hadConfig) {
			report.todo.push(
				exists(schemaFile)
					? `${schemaFile} exists: load it from ${configFile} (defineConfig({ schema, ... })) and run \`monti schema:types\``
					: `Move the data in ${configFile} (collections, locales, ...) to ${schemaFile} with \`monti schema:extract\`.`,
			);
		}
		if (adminPath !== DEFAULT_ADMIN_PATH && !read(configFile).includes(adminPath)) {
			report.todo.push(
				`Add admin: { path: "${adminPath}" } to ${exists(schemaFile) ? schemaFile : configFile} (it must match the admin route folder).`,
			);
		}
	} else {
		create(schemaFile, schemaTemplate(adminPath, { locale, timeZone }, linkFrom(schemaFile)));
		// The types are written from the schema, so `cms.read` and the admin know the collections from the first run.
		if (exists(typesFile)) report.skipped.push(typesFile);
		else {
			generateSchemaTypes({ cwd, schema: schemaFile });
			report.created.push(typesFile);
		}
		const tsconfig = exists("tsconfig.json") ? parseJsonc(read("tsconfig.json")) : undefined;
		const options = (tsconfig as { compilerOptions?: { resolveJsonModule?: boolean } } | undefined)?.compilerOptions;
		if (tsconfig !== undefined && options?.resolveJsonModule !== true) {
			report.todo.push(`Set "resolveJsonModule": true in tsconfig.json (${configFile} imports ${schemaFile}).`);
		}
	}
	// The generated files import the CMS instance from the config file, by a path relative to themselves.
	const configImport = (from: string) =>
		dotted(posix(path.relative(path.dirname(from), configFile.replace(/\.ts$/, ""))));
	const adminDir = posix(path.join(appDir, ...adminPath.split("/").filter(Boolean)));
	const pageFile = `${adminDir}/[[...path]]/page.tsx`;
	const layoutFile = `${adminDir}/layout.tsx`;
	const routeFile = `${appDir}/api/cms/[...path]/route.ts`;
	create(pageFile, adminPageTemplate(configImport(pageFile)));
	create(layoutFile, adminLayoutTemplate(configImport(layoutFile)));
	create(routeFile, apiRouteTemplate(configImport(routeFile)));

	addWithCms(cwd, report);

	report.todo.push(
		`Install packages: ${INSTALL_COMMANDS.join(" && ")}`,
		[
			"Values for .env.local (next dev signs you in on its own, so the GitHub ones are for production):",
			...ENV_VARS.map((env) => `  ${env.name.padEnd(22)} ${env.required ? "" : "(optional) "}${env.note}`),
		].join("\n"),
		`Edit the collections in ${hadConfig ? configFile : schemaFile}, run \`monti migrate\` to create the database tables, then open ${adminPath} in next dev.`,
	);
	return report;
}

/** Wraps the next config with `withCms`. Only edits the default shape (a single `export default nextConfig;` line), and creates one if missing. */
function addWithCms(cwd: string, report: InitReport): void {
	const file = NEXT_CONFIGS.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (!file) {
		writeFileSync(path.join(cwd, "next.config.ts"), nextConfigTemplate());
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
			`Wrap the config in ${file}: import { withCms } from "@monti-cms/nextjs/config"; export default withCms(nextConfig);`,
		);
		return;
	}
	const importLine = 'import { withCms } from "@monti-cms/nextjs/config";\n';
	const replaced = text.replace(exportLine, "export default withCms(nextConfig);");
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
