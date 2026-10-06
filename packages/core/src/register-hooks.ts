import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Node module resolution hook (registered by `register.ts` and `monti migrate`). Only the site config alias is redirected to the app's file; everything else passes through.
 * The file path comes from the value passed at registration (`initialize`); otherwise `CMS_CONFIG_PATH` (default `./cms.config.ts`, relative to the current directory).
 */
let aliases: Readonly<Record<string, string>> = {
	"@cms-config": process.env.CMS_CONFIG_PATH ?? "./cms.config.ts",
};

/** Alias files passed at registration (`register(url, { data: { aliases } })`). */
export const initialize = (data?: { aliases?: Readonly<Record<string, string>> }) => {
	if (data?.aliases) aliases = { ...aliases, ...data.aliases };
};

type Resolve = (
	specifier: string,
	context: unknown,
	next: (specifier: string, context: unknown) => Promise<unknown>,
) => Promise<unknown>;

export const resolve: Resolve = (specifier, context, next) => {
	const file = aliases[specifier];
	return file ? next(pathToFileURL(path.resolve(process.cwd(), file)).href, context) : next(specifier, context);
};
