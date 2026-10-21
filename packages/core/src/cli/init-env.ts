import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** The `.env.local` step of `monti init`: create it from `.env.example` when it is not there, and fill an empty `MONTI_SECRET`. Nothing else in an existing file is touched. */

export const ENV_LOCAL = ".env.local";
export const ENV_EXAMPLE = ".env.example";

/** The placeholder `.env.example` carries for `DATABASE_URL`: copying the file does not give a database. */
const PLACEHOLDER_DATABASE_URL = /^postgres(?:ql)?:\/\/user:password@host[:/]/;

/** A new secret: 32 random bytes as base64, the same as the `openssl rand -base64 32` the docs recommend. */
export const generateSecret = (): string => randomBytes(32).toString("base64");

export type EnvFileResult =
	| { readonly action: "created" }
	/** The file was there: `secret` says whether its `MONTI_SECRET` was empty (now filled), missing (now added) or already set (kept). */
	| { readonly action: "kept"; readonly secret: "filled" | "added" | "kept" }
	| { readonly action: "missing-example" };

const SECRET_LINE = /^([ \t]*(?:export[ \t]+)?MONTI_SECRET[ \t]*=)[^\n]*$/m;

/** The value of `name` in the text of an env file, trimmed; `undefined` when the line is missing or the text cannot be read as an env file. */
export function envValue(text: string, name: string): string | undefined {
	try {
		const value = parseEnv(text)[name];
		return value === undefined ? undefined : value.trim();
	} catch {
		return undefined;
	}
}

const withLine = (text: string, line: string) => `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${line}\n`;

/**
 * Makes sure `.env.local` exists and holds a `MONTI_SECRET`. Absent: copied from `.env.example`, with the secret filled in. Present: a line is changed only when it is
 * `MONTI_SECRET=` with no value (or the variable is missing, which appends it); every other line stays byte for byte. Never overwrites a value.
 */
export function prepareEnvFile(cwd: string, secret: string = generateSecret()): EnvFileResult {
	const target = path.join(cwd, ENV_LOCAL);
	if (!existsSync(target)) {
		const example = path.join(cwd, ENV_EXAMPLE);
		if (!existsSync(example)) return { action: "missing-example" };
		const text = readFileSync(example, "utf8");
		const filled = SECRET_LINE.test(text)
			? text.replace(SECRET_LINE, (_line, head: string) => `${head}${secret}`)
			: withLine(text, `MONTI_SECRET=${secret}`);
		writeFileSync(target, filled, { flag: "wx" });
		return { action: "created" };
	}
	const text = readFileSync(target, "utf8");
	if (envValue(text, "MONTI_SECRET")) return { action: "kept", secret: "kept" };
	if (SECRET_LINE.test(text)) {
		writeFileSync(
			target,
			text.replace(SECRET_LINE, (_line, head: string) => `${head}${secret}`),
		);
		return { action: "kept", secret: "filled" };
	}
	writeFileSync(target, withLine(text, `MONTI_SECRET=${secret}`));
	return { action: "kept", secret: "added" };
}

/** The database URL init can use: from the environment, else from `.env.local` (the placeholder of `.env.example` does not count). `undefined` when there is none. */
export function databaseUrl(cwd: string, env: Record<string, string | undefined>): string | undefined {
	const fromEnv = env.DATABASE_URL?.trim();
	const file = path.join(cwd, ENV_LOCAL);
	const fromFile = existsSync(file) ? envValue(readFileSync(file, "utf8"), "DATABASE_URL") : undefined;
	const url = fromEnv || fromFile;
	return url && !PLACEHOLDER_DATABASE_URL.test(url) ? url : undefined;
}
