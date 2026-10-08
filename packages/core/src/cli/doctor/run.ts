import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import type { Cms } from "../../cms";
import { importCms } from "../app";
import { resolveConfigPath } from "../config-paths";
import { DEFAULT_ENV_FILES, loadEnvFiles } from "../env";
import { CORE_CHECKS, type DoctorState, GROUP_ORDER } from "./core-checks";
import { type DoctorReport, type DoctorResult, summarize } from "./format";
import type { CheckOutcome } from "./outcome";

export interface DoctorOptions {
	/** The app folder. */
	readonly cwd: string;
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
	/** Config file (`monti.config.ts`). */
	readonly config?: string;
	/** Run only these checks: a group (`database`, `auth`) or one check (`database/migrations`). */
	readonly only?: readonly string[];
	/** The environment to read and fill from the env files. Default `process.env`: the config file reads that one when it loads. */
	readonly env?: Record<string, string | undefined>;
}

/** One check may take this long (a database or a service that never answers must not hang the command). */
const CHECK_TIMEOUT_MS = 30_000;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The variables of each env file that exists (so a message can say which file holds a value). */
function readEnvSources(cwd: string, files: readonly string[] | undefined): Map<string, Record<string, string>> {
	const sources = new Map<string, Record<string, string>>();
	for (const file of files ?? DEFAULT_ENV_FILES) {
		const full = path.resolve(cwd, file);
		if (!existsSync(full)) continue;
		try {
			const values: Record<string, string> = {};
			for (const [key, value] of Object.entries(parseEnv(readFileSync(full, "utf8")))) {
				if (value !== undefined) values[key] = value;
			}
			sources.set(file, values);
		} catch {
			// an unreadable env file is reported by loading it
		}
	}
	return sources;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
	new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`the check did not finish in ${ms / 1000} seconds`)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});

const matches = (only: readonly string[] | undefined, group: string, id: string): boolean =>
	!only || only.length === 0 || only.some((item) => item === group || item === `${group}/${id}`);

/** Runs one check and turns whatever it does into a result: a throw is a fail with the message. */
async function runOne(
	group: string,
	check: { readonly id: string; readonly title: string },
	run: () => CheckOutcome | Promise<CheckOutcome>,
): Promise<DoctorResult> {
	const base = {
		id: `${group}/${check.id}`,
		group,
		title: check.title,
	};
	try {
		const outcome = await withTimeout(Promise.resolve().then(run), CHECK_TIMEOUT_MS);
		return {
			...base,
			status: outcome.status,
			message: outcome.message,
			...(outcome.where ? { where: outcome.where } : {}),
			...(outcome.fix ? { fix: outcome.fix } : {}),
		};
	} catch (error) {
		return { ...base, status: "fail", message: `the check itself failed: ${messageOf(error)}` };
	}
}

/**
 * `monti doctor`: reads the env files, finds and loads the config file, then runs the checks of core (config, schema, database, secrets, login settings, Next files, upgrade), and returns what each found. It changes nothing, and never prints a secret. The instance it loads is closed before it returns.
 */
export async function runDoctor(options: DoctorOptions): Promise<DoctorReport> {
	const env = options.env ?? process.env;
	const { cwd, only } = options;

	let envFiles: string[] = [];
	let envError: Error | undefined;
	try {
		envFiles = loadEnvFiles(cwd, options.envFiles, env);
	} catch (error) {
		envError = error instanceof Error ? error : new Error(String(error));
	}

	let configPath: string | undefined;
	let configError: Error | undefined;
	try {
		configPath = resolveConfigPath(cwd, options.config, env);
	} catch (error) {
		configError = error instanceof Error ? error : new Error(String(error));
	}
	let configText: string | undefined;
	if (configPath) {
		try {
			configText = readFileSync(path.resolve(cwd, configPath), "utf8");
		} catch {
			configText = undefined;
		}
	}

	let cms: Cms | undefined;
	let loadError: unknown;
	if (configPath) {
		try {
			cms = await importCms(cwd, configPath);
		} catch (error) {
			loadError = error;
		}
	}

	const state: DoctorState = {
		cwd,
		env,
		envFiles,
		envSources: readEnvSources(cwd, options.envFiles),
		...(envError ? { envError } : {}),
		...(configPath ? { configPath } : {}),
		...(configError ? { configError } : {}),
		...(configText !== undefined ? { configText } : {}),
		...(cms ? { cms } : {}),
		...(loadError !== undefined ? { loadError } : {}),
	};

	const results: DoctorResult[] = [];
	try {
		for (const check of CORE_CHECKS) {
			if (!matches(only, check.group, check.id)) continue;
			if (check.needsCms && !cms) {
				results.push({
					id: `${check.group}/${check.id}`,
					group: check.group,
					title: check.title,
					status: "skip",
					message: configPath
						? "not checked: the config file did not load (see config/loads)"
						: "not checked: no config file (see config/file)",
				});
				continue;
			}
			results.push(await runOne(check.group, check, () => check.run(state)));
		}
	} finally {
		await cms?.close().catch(() => undefined);
	}

	const rank = (group: string) => {
		const index = (GROUP_ORDER as readonly string[]).indexOf(group);
		return index === -1 ? GROUP_ORDER.length : index;
	};
	const ordered = results
		.map((result, index) => ({ result, index }))
		.sort((a, b) => rank(a.result.group) - rank(b.result.group) || a.index - b.index)
		.map(({ result }) => result);
	const summary = summarize(ordered);
	return { ok: summary.fail === 0, cwd, summary, checks: ordered };
}
