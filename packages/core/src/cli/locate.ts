import { existsSync } from "node:fs";
import path from "node:path";
import type { ErrorCode } from "../core/error-codes";
import { problemError } from "../core/problem";
import { findSchemaFile, SCHEMA_FILE_CANDIDATES } from "../schema-file/locate";

/**
 * Where the files `monti` works on are found: the config file, the file `schema:extract` reads, and the schema file. Every lookup is the same: the file the person
 * chose (an option, or an environment variable) must exist, else the first of the usual locations that exists, and a missing file is a `SetupError` that says what
 * is missing, where `monti` looked and how to fix it. Paths are relative to `cwd`.
 */

interface Lookup {
	readonly cwd: string;
	/** The path the person gave. */
	readonly chosen?: string;
	/** The environment variable that can name the file, and its value. */
	readonly fromEnv?: { readonly name: string; readonly value: string | undefined };
	/** The usual locations, the first that exists wins. */
	readonly candidates: readonly string[];
	/** The option that names the file (`--config`). */
	readonly option: string;
	/** What the file is, in the messages (`config file`). */
	readonly label: string;
	/** How to fix a file that cannot be found anywhere. */
	readonly notFoundFix: string;
	readonly kind: ErrorCode;
}

function locate(lookup: Lookup): string {
	const { cwd, chosen, candidates } = lookup;
	const fromEnv = lookup.fromEnv?.value || undefined;
	const found = chosen ?? fromEnv ?? candidates.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (found && existsSync(path.resolve(cwd, found))) return found;
	throw problemError(
		found
			? {
					what: `The ${lookup.label} ${found} does not exist`,
					where: chosen ? `the ${lookup.option} option` : `the ${lookup.fromEnv?.name} environment variable`,
					fix: `correct the path (it is relative to ${cwd}), or remove the option so \`monti\` looks for ${candidates.join(" or ")}`,
				}
			: {
					what: `Cannot find ${candidates[0]} (looked in ${cwd}, also under src/)`,
					where: "the folder you ran `monti` in",
					fix: lookup.notFoundFix,
				},
		undefined,
		lookup.kind,
	);
}

/** Candidate locations of the config file, the module that exports the CMS instance as `cms`. */
export const CONFIG_CANDIDATES = ["monti.config.ts", "src/monti.config.ts"] as const;

/**
 * Location of the config file (`monti.config.ts`, the module that exports the CMS instance as `cms`). Looked up in this order: the chosen value
 * (`--config`) -> the `MONTI_CONFIG_PATH` environment variable -> common locations (`./monti.config.ts`, `./src/monti.config.ts`).
 */
export function locateConfig(
	cwd: string,
	chosen: string | undefined = undefined,
	env: Record<string, string | undefined> = process.env,
): string {
	return locate({
		cwd,
		chosen,
		fromEnv: { name: "MONTI_CONFIG_PATH", value: env.MONTI_CONFIG_PATH },
		candidates: CONFIG_CANDIDATES,
		option: "--config",
		label: "config file",
		notFoundFix:
			"run `monti` from the folder of your Next app, or point at the file with --config <path> or MONTI_CONFIG_PATH; `monti init` creates one in an app that has none",
		kind: "config_missing",
	});
}

/**
 * Where a site keeps the config `monti schema:extract` reads, in the order it looks: `monti.config.ts` (a config whose data is still written in code), then the
 * site config file of the earlier setup (`cms.config.ts`, a default export of `defineSite` from `@monti-cms/core`).
 */
export const EXTRACT_CONFIG_CANDIDATES = [
	"monti.config.ts",
	"src/monti.config.ts",
	"cms.config.ts",
	"src/cms.config.ts",
] as const;

/** The config file `monti schema:extract` reads: the chosen path (`--config`), else the first of {@link EXTRACT_CONFIG_CANDIDATES}. */
export function locateExtractConfig(cwd: string, chosen?: string): string {
	return locate({
		cwd,
		chosen,
		candidates: EXTRACT_CONFIG_CANDIDATES,
		option: "--config",
		label: "config file",
		notFoundFix: "run `monti` from the folder of your app, or pass --config <path>",
		kind: "config_missing",
	});
}

/** The schema file of a site: the chosen path (`--schema`), else the first of {@link SCHEMA_FILE_CANDIDATES}. The lookup itself lives with the schema file format. */
export const locateSchema: (cwd: string, chosen?: string) => string = findSchemaFile;

export { SCHEMA_FILE_CANDIDATES };
