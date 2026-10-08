import type { Decision } from "../server/decision";

type Env = Readonly<Record<string, string | undefined>>;

/** What the instance decided on its own besides what the database and login adapters report: host trust, the site URL, the schema file. */
export function coreDecisions(input: {
	readonly env: Env;
	readonly trust: { readonly trusted: boolean; readonly source: string };
	readonly siteUrl: string | undefined;
	readonly siteUrlSource: string | undefined;
	/** The schema file, relative to the working directory, or `undefined` when the site has none. */
	readonly schemaFile: string | undefined;
	readonly schemaFileGiven: boolean;
	readonly hotReload: boolean;
}): readonly Decision[] {
	const { env } = input;
	return [
		{ topic: "Trust host", value: input.trust.trusted ? "on" : "off", source: input.trust.source },
		{
			topic: "SITE_URL",
			value: input.siteUrl ?? "not set",
			source:
				input.siteUrlSource ??
				(input.siteUrl ? "set in monti.config.ts" : "not set in the schema file, monti.config.ts or env SITE_URL"),
		},
		{
			topic: "Schema file",
			value: input.schemaFile ?? "none (the collections are written in monti.config.ts)",
			source: input.schemaFile
				? input.schemaFileGiven
					? "set in monti.config.ts"
					: "auto-detected (monti.schema.json in the app folder)"
				: "no schema file found",
		},
		{
			topic: "Schema hot reload",
			value: input.hotReload ? "on" : "off",
			source: input.hotReload
				? 'auto-detected (NODE_ENV is "development": the schema file is read again when it changes)'
				: input.schemaFile
					? `auto-detected (NODE_ENV is "${env.NODE_ENV ?? ""}": a server runs the schema it started with)`
					: "no schema file to reload",
		},
	];
}
