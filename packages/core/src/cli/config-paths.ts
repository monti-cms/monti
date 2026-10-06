import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Config alias name. CMS code reads the site config file through this name. */
export const CONFIG_ALIAS = "@cms-config";

/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export function parseJsonc(text: string): unknown {
	let out = "";
	let inString = false;
	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		const next = text[index + 1];
		if (inString) {
			out += char;
			if (char === "\\") {
				out += next ?? "";
				index++;
			} else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			out += char;
		} else if (char === "/" && next === "/") {
			while (index < text.length && text[index] !== "\n") index++;
			out += "\n";
		} else if (char === "/" && next === "*") {
			index += 2;
			while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index++;
			index++;
		} else out += char;
	}
	try {
		return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
	} catch {
		return undefined;
	}
}

interface TsconfigLike {
	readonly compilerOptions?: {
		readonly baseUrl?: string;
		readonly paths?: Readonly<Record<string, readonly string[]>>;
	};
}

/** Alias file listed in tsconfig `paths` (relative to `cwd`). `undefined` if none. */
export function tsconfigAliasPath(cwd: string, alias: string): string | undefined {
	const file = path.join(cwd, "tsconfig.json");
	if (!existsSync(file)) return undefined;
	const tsconfig = parseJsonc(readFileSync(file, "utf8")) as TsconfigLike | undefined;
	const target = tsconfig?.compilerOptions?.paths?.[alias]?.[0];
	if (!target) return undefined;
	const base = path.resolve(cwd, tsconfig?.compilerOptions?.baseUrl ?? ".");
	return path.relative(cwd, path.resolve(base, target)) || target;
}

export interface ConfigPaths {
	/** Site config file (relative to `cwd`). */
	readonly config: string;
	/** Server file, the module that exports the CMS instance as `cms` (relative to `cwd`). */
	readonly server: string;
}

const CANDIDATES = {
	config: ["cms.config.ts", "src/cms.config.ts"],
	server: ["cms.server.ts", "src/cms.server.ts"],
} as const;

/**
 * Locations of the site config file and the server file (the module that exports the CMS instance). Looked up in this order: the chosen value (`--config`, `--server`) ->
 * environment variable (`CMS_CONFIG_PATH`, `CMS_SERVER_PATH`) -> for the site config only, the tsconfig `paths` alias -> common locations
 * (`./cms.config.ts`, `./src/cms.config.ts`, `./cms.server.ts`, `./src/cms.server.ts`). It is an error if the file is missing.
 */
export function resolveConfigPaths(
	cwd: string,
	chosen: { config?: string; server?: string } = {},
	env: Record<string, string | undefined> = process.env,
): ConfigPaths {
	const find = (kind: "config" | "server", envName: string, flag: string): string => {
		const given = chosen[kind] ?? env[envName];
		const found =
			given ??
			(kind === "config" ? tsconfigAliasPath(cwd, CONFIG_ALIAS) : undefined) ??
			CANDIDATES[kind].find((candidate) => existsSync(path.join(cwd, candidate)));
		if (!found || !existsSync(path.resolve(cwd, found))) {
			throw new Error(
				found
					? `${kind === "config" ? CONFIG_ALIAS : "server"} file not found: ${found}`
					: `cannot find ${CANDIDATES[kind][0]}; pass ${flag} <path> or set ${envName} (run \`monti init\` to create one)`,
			);
		}
		return found;
	};
	return {
		config: find("config", "CMS_CONFIG_PATH", "--config"),
		server: find("server", "CMS_SERVER_PATH", "--server"),
	};
}
