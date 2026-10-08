import { type Decision, formatDecision } from "../server/decision";

/** The environment variable that hides the startup summary (`MONTI_QUIET=1`). */
export const QUIET_ENV = "MONTI_QUIET";
/** Set by `withCms` of `@monti-cms/nextjs`: what it added to the Next config. */
export const WITHCMS_ENV = "MONTI_WITHCMS";

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

/** The decisions `withCms` made, from the environment variable it sets (see {@link WITHCMS_ENV}). */
export function withCmsDecision(env: Env): Decision {
	const added = env[WITHCMS_ENV];
	return added
		? { topic: "withCms (next.config)", value: added, source: "set in next.config.ts; remove withCms to undo" }
		: {
				topic: "withCms (next.config)",
				value: "not used",
				source: "add withCms from @monti-cms/nextjs/config to next.config.ts (monti init does)",
			};
}

/** The summary as text: one line per decision under a one-line heading that says how to hide it. */
export function startupSummaryText(decisions: readonly Decision[]): string {
	return [
		`monti: what was decided automatically (hide this with ${QUIET_ENV}=1; \`monti doctor\` lists the same)`,
		...decisions.map((decision) => `  - ${formatDecision(decision)}`),
	].join("\n");
}

/** Whether the summary stays quiet: `MONTI_QUIET`, tests, a build, and the command line tool (which has its own output). */
export function startupQuiet(env: Env = process.env): boolean {
	const quiet = env[QUIET_ENV]?.trim().toLowerCase();
	return (
		quiet === "1" ||
		quiet === "true" ||
		env.NODE_ENV === "test" ||
		Boolean(env.VITEST) ||
		env.NEXT_PHASE === "phase-production-build" ||
		env.MONTI_CLI === "1"
	);
}

const ANNOUNCED = Symbol.for("monti.startup-summary.announced");

/**
 * Prints the summary once per process, the first time an instance connects to something (the database or the login), so a build that only imports the config
 * prints nothing. Never throws: a summary that cannot be built is not worth stopping the server for.
 */
export function announceStartup(
	decisions: () => readonly Decision[],
	env: Env = process.env,
	log: (text: string) => void = console.log,
): void {
	const holder = globalThis as { [ANNOUNCED]?: boolean };
	if (holder[ANNOUNCED] || startupQuiet(env)) return;
	holder[ANNOUNCED] = true;
	try {
		log(startupSummaryText([...decisions(), withCmsDecision(env)]));
	} catch {
		// see above
	}
}
