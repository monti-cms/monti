import { existsSync } from "node:fs";
import path from "node:path";
import { explainTrustHost } from "../adapters/auth/trust-host";
import type { CmsConfig } from "../config/define";
import { findSchemaFile } from "../schema-file/locate";
import { schemaSourceOf } from "../schema-file/source";
import type { Decision } from "../server/decision";
import type { CmsServerConfig } from "../server/define";
import { coreDecisions } from "./decisions";
import type { Cms, CreateCmsOptions, SchemaReload } from "./types";

/** The members of an instance that are not rebuilt with the site. */
export type SchemaMembers = "schemaFile" | "forSchema" | "reloadSchema" | "decisions";

/**
 * Puts the parts that depend on the schema (`build`: the site, the stores, the services, the read API) together with the members that do not (`schemaFile`,
 * `forSchema`, `reloadSchema`, `decisions`) into the instance. `reloadSchema` rebuilds the parts in place, in development: `site` is a getter, and every other part is
 * assigned over, so the cache of `cms.plugin(name).once` starts afresh with them.
 */
export function withSchemaControls<Config extends CmsConfig>(parts: {
	readonly options: CreateCmsOptions<Config>;
	readonly server: CmsServerConfig;
	readonly build: (config: Config, self: () => Cms<Config>) => Omit<Cms<Config>, SchemaMembers>;
}): Cms<Config> {
	const { options, server, build } = parts;
	const source = schemaSourceOf(options.config);
	/** The schema file of the config, found on first use (creating the instance does no file access). */
	let schemaPath: string | null | undefined;
	const schemaFile = (): string | undefined => {
		if (schemaPath === undefined) {
			schemaPath = null;
			if (source) {
				try {
					schemaPath = path.resolve(process.cwd(), options.schemaFile ?? findSchemaFile(process.cwd()));
					if (!existsSync(schemaPath)) schemaPath = null;
				} catch {
					schemaPath = null;
				}
			}
		}
		return schemaPath ?? undefined;
	};

	const forSchema = (schema: unknown): Cms<Config> => {
		if (!source)
			throw new Error("cms: this instance's config has no schema file (it is not made with `defineSite({ schema })`)");
		const next = source.rebuild(schema) as Config;
		const detached: Cms<Config> = {
			...build(next, () => detached),
			schemaFile,
			forSchema: (other) => cms.forSchema(other),
			reloadSchema: () => ({ reloaded: false, reason: "detached" }),
			decisions: (env) => cms.decisions(env),
		};
		return detached;
	};

	// The part of the instance that changes when the schema is reloaded.
	let current = build(options.config, () => cms);
	let reported: string | undefined;
	const reloadSchema = (schema: unknown): SchemaReload => {
		if (process.env.NODE_ENV !== "development") return { reloaded: false, reason: "production" };
		if (!source) return { reloaded: false, reason: "no_schema_file" };
		try {
			const next = build(source.rebuild(schema) as Config, () => cms);
			const { site: _site, ...rebuilt } = next;
			current = next;
			Object.assign(cms, rebuilt);
			reported = undefined;
			return { reloaded: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// A schema that is invalid is reported once; the instance keeps running the last good one.
			if (message !== reported) console.error(`monti: the schema was not reloaded: ${message}`);
			reported = message;
			return { reloaded: false, reason: message };
		}
	};

	const decisions = (env: Readonly<Record<string, string | undefined>> = process.env): readonly Decision[] => {
		const file = schemaFile();
		return [
			...(server.database.inspector?.decisions(env) ?? []),
			...(server.auth.decisions?.(env) ?? []),
			...coreDecisions({
				env,
				trust: explainTrustHost(server.trustHost, env),
				siteUrl: current.site.config.site?.url,
				siteUrlSource: options.siteUrlSource,
				schemaFile: file ? path.relative(process.cwd(), file) || file : undefined,
				schemaFileGiven: Boolean(options.schemaFile),
				hotReload: env.NODE_ENV === "development" && Boolean(source && file),
			}),
		];
	};

	const { site: _first, ...rest } = current;
	const cms: Cms<Config> = Object.defineProperties(
		{ ...rest, schemaFile, forSchema, reloadSchema, decisions } as Cms<Config>,
		{
			site: { enumerable: true, get: () => current.site },
		},
	);
	return cms;
}
