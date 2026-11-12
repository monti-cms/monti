import { type Kysely, type Selectable, sql, type Transaction } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import type { ApiKeyTable, Database } from "../db/schema";
import { CheckError, ConflictError } from "../errors";
import { defineOperation, type OperationContext } from "../operation";
import { defineRecordKind, lockRecords } from "../records";
import type { Site } from "../site";
import { seal, unseal } from "./seal";
import { checkKey, KEY_LENGTH_THAT_MATTERS, type KeyService, type Model } from "./services";

type Db = Kysely<Database> | Transaction<Database>;
type KeyRecord = Selectable<ApiKeyTable>;

/** How long a key's model list is kept before the service is asked again. */
const MODELS_FRESH_MS = 86_400_000;
/**
 * How long a service that failed to give its list is left alone. Without it a service that is down would be asked, and waited ten seconds for,
 * every time the model menu opens.
 */
export const MODELS_RETRY_MS = 15 * 60_000;

/** Where a key is at work: the assistant's starting model comes from it, or the quick tasks' model does. */
export type KeyUse = { for: "assistant" | "quick"; model: string };

export type KeyRow = {
	id: string;
	service: string;
	/** The service's name, or its id when no plugin brings that service any more. */
	serviceName: string;
	name: string;
	/** The key's last four characters; empty for a key too short to show any, and for a service that needs none. */
	last4: string;
	baseUrl: string | null;
	/** Whether the server's secret opens it. One that does not is entered again. */
	readable: boolean;
	/** Tokens this month. Money and limits are not counted (doc 10). */
	usage: { month: string; tokens: number };
	uses: KeyUse[];
	/** The key's version, by `recordKey({ kind: "key", id })`: a change sent with it is refused when the key changed since it was read. */
	version: number;
};

export type KeyServiceRow = {
	id: string;
	name: string;
	address: boolean;
	keyOptional: boolean;
	placeholder: string | null;
};

export type KeyList = {
	/** Whether the server has `MONTI_SECRET`: without it no key can be stored. */
	canStore: boolean;
	keys: KeyRow[];
	/** The services a key can be added for. */
	services: KeyServiceRow[];
};

export type ModelChoice = { keyId: string; model: string };

export type ModelList = {
	/** The keys that can be read, each with the models it can use. */
	keys: { id: string; name: string; service: string; models: Model[] }[];
	/** The model a new conversation starts with: the first key's service's own default. */
	assistant: ModelChoice | null;
	/** The model the quick tasks call: the one picked on the keys screen, or the first key's service's own until one is. */
	quick: (ModelChoice & { chosen: boolean }) | null;
};

/** `2026-11`: usage is counted per calendar month, in UTC. */
const monthOf = (at: Date) => at.toISOString().slice(0, 7);

/** A key too short to matter shows no ending: four characters would be most of it. */
const ending = (secret: string) => (secret.length >= KEY_LENGTH_THAT_MATTERS ? secret.slice(-4) : "");

const serviceOf = (ctx: OperationContext, id: string) => ctx.site.keyServices.find((service) => service.id === id);

const keysInOrder = (db: Db): Promise<KeyRecord[]> =>
	db.selectFrom("api_keys").selectAll().orderBy("created_at").orderBy("id").execute();

/** Opens a stored key: only in the row it was sealed for, with the service and address it was sealed for. */
const opened = (secret: string, key: KeyRecord) =>
	unseal(secret, key.secret, { id: key.id, service: key.service, baseUrl: key.base_url });

/** The server's secret, or the refusal every key write gives without one. */
function secretOf(ctx: OperationContext): string {
	if (ctx.site.secret === null) throw new CheckError({ key: "keys.noSecret" });
	return ctx.site.secret;
}

/**
 * A key as the engine sees it: a record with a version, so two changes of one key run one after the other, and a change made from an old reading is
 * a conflict (doc 00). Its state never holds the key itself, and it is not restored: adding, changing and removing a key have no undo (doc 14).
 */
export const keyRecord = defineRecordKind({
	kind: "key",
	async load(db, ids) {
		const rows = await db
			.selectFrom("api_keys")
			.select(["id", "version", "name", "service", "base_url"])
			.where("id", "in", ids)
			.execute();
		return rows.map(({ id, version, ...data }) => ({ id, version, data }));
	},
	async restore() {
		throw new Error("A service key is not restored: adding, changing and removing one cannot be undone.");
	},
});

/** Holds a key name until the write ends, so two keys cannot take one name at the same moment. */
const lockName = (ctx: OperationContext, name: string) => lockRecords(ctx.db, [{ kind: "key-name", id: name }]);

/** Each key with whether the server's secret opens it. */
async function readKeys(ctx: OperationContext) {
	const secret = ctx.site.secret;
	return Promise.all(
		(await keysInOrder(ctx.db)).map(async (key) => ({
			...key,
			readable: secret !== null && (await opened(secret, key)) !== null,
		})),
	);
}

/** The first of the service's preferred models the key can use, or the key's first model. */
const preferred = (models: Model[], wanted: string[] | undefined) =>
	wanted?.find((id) => models.some((model) => model.id === id)) ?? models[0]?.id;

/** Whether a key can give a model: the server reads it, and its service is still one the site has (a removed plugin's key gives none). */
const usable = (ctx: OperationContext, key: KeyRecord & { readable: boolean }) =>
	key.readable && serviceOf(ctx, key.service) !== undefined;

/** The models at work before and after anyone picks (doc 10: a new conversation starts with the first key's service's default). */
async function startingModels(
	ctx: OperationContext,
	keys: (KeyRecord & { readable: boolean })[],
): Promise<Pick<ModelList, "assistant" | "quick">> {
	const giving = keys.filter((key) => usable(ctx, key) && key.models.length > 0);
	const first = giving[0];
	const own = (role: "assistant" | "quick") => {
		const model = first && preferred(first.models, serviceOf(ctx, first.service)?.defaults?.[role]);
		return first && model ? { keyId: first.id, model } : null;
	};
	const picked = await ctx.db
		.selectFrom("model_choices")
		.select(["key_id", "model"])
		.where("role", "=", "quick")
		.executeTakeFirst();
	const stillThere =
		picked && giving.some((key) => key.id === picked.key_id && key.models.some((model) => model.id === picked.model));
	const builtIn = own("quick");
	return {
		assistant: own("assistant"),
		quick: stillThere
			? { keyId: picked.key_id, model: picked.model, chosen: true }
			: builtIn && { ...builtIn, chosen: false },
	};
}

/**
 * A service's address as it is stored: its origin and path, without the trailing slash. A query, a fragment, or a user name and password in it are
 * refused: the path the check adds (`/models`) would land inside the query or after the `#`, so the request would go somewhere else than the
 * address reads, and `fetch` takes no address with credentials at all.
 */
function address(raw: string | undefined): string {
	const given = (raw ?? "").trim();
	let url: URL | null = null;
	try {
		url = new URL(given);
	} catch {}
	if (
		!url ||
		!["http:", "https:"].includes(url.protocol) ||
		url.username !== "" ||
		url.password !== "" ||
		given.includes("?") ||
		given.includes("#")
	)
		throw new CheckError({ key: "keys.badAddress" });
	return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/** Asks the service once whether it takes the key (doc 14: on add, and again whenever the key or its address changes). */
async function ask(ctx: OperationContext, service: KeyService, secret: string, baseUrl: string | null) {
	if (secret === "" && !service.keyOptional) throw new CheckError({ key: "keys.needsKey" });
	const checked = await checkKey(service, { secret, baseUrl }, ctx.site.fetch);
	if (!checked.ok) throw new CheckError({ key: checked.reason === "refused" ? "keys.refused" : "keys.unreachable" });
	return checked.models;
}

async function mustBeFree(ctx: OperationContext, name: string, except?: string) {
	const taken = await ctx.db.selectFrom("api_keys").select("id").where("name", "=", name).executeTakeFirst();
	if (taken && taken.id !== except) throw new CheckError({ key: "keys.nameTaken", values: { name } });
}

/**
 * The refreshes of a site that are on their way, by key and its sealed value: calls that want the same list at the same moment share one. A refresh
 * is the question to the service and the write of its answer (or of its failure's time): it is shared until the row says what came of it, so a call
 * that arrives while the write waits does not read the old row and ask again.
 */
const onTheirWay = new WeakMap<Site, Map<string, Promise<void>>>();

function sharedRefresh(site: Site, key: KeyRecord, refresh: () => Promise<void>): Promise<void> {
	let refreshes = onTheirWay.get(site);
	if (!refreshes) {
		refreshes = new Map();
		onTheirWay.set(site, refreshes);
	}
	const name = `${key.id}\n${key.secret}`;
	const running = refreshes.get(name);
	if (running) return running;
	const started = refresh().finally(() => refreshes.delete(name));
	refreshes.set(name, started);
	return started;
}

const Name = z.string().trim().min(1).max(60);

export const keyOperations = [
	defineOperation({
		name: "keys.list",
		kind: "read",
		description:
			"The service keys: each one's name, service, last four characters, tokens used this month and where it is used. Never the key itself. Also the services a key can be added for, and whether the server can store keys at all.",
		input: z.object({}),
		async run(_input, ctx): Promise<KeyList> {
			const keys = await readKeys(ctx);
			const { assistant, quick } = await startingModels(ctx, keys);
			const month = monthOf(ctx.now());
			const used = new Map(
				(
					await ctx.db.selectFrom("api_key_usage").select(["key_id", "tokens"]).where("month", "=", month).execute()
				).map((row) => [row.key_id, Number(row.tokens)]),
			);
			return {
				canStore: ctx.site.secret !== null,
				keys: keys.map((key) => ({
					id: key.id,
					service: key.service,
					serviceName: serviceOf(ctx, key.service)?.name ?? key.service,
					name: key.name,
					last4: key.last4,
					baseUrl: key.base_url,
					readable: key.readable,
					usage: { month, tokens: used.get(key.id) ?? 0 },
					uses: [
						...(assistant?.keyId === key.id ? [{ for: "assistant" as const, model: assistant.model }] : []),
						...(quick?.keyId === key.id ? [{ for: "quick" as const, model: quick.model }] : []),
					],
					version: key.version,
				})),
				services: ctx.site.keyServices.map((service) => ({
					id: service.id,
					name: service.name,
					address: service.address ?? false,
					keyOptional: service.keyOptional ?? false,
					placeholder: service.placeholder ?? null,
				})),
			};
		},
	}),
	defineOperation({
		name: "keys.add",
		kind: "write",
		humanOnly: true,
		secretInputs: ["secret"],
		description:
			"Add a service key. The service is asked once whether it takes the key; a key it refuses is not stored. Only a person does it: it needs the key itself.",
		input: z.object({
			service: z.string(),
			name: Name,
			/** The key itself. Empty only for a service that needs none. */
			secret: z.string().trim(),
			/** The service's address, for a service that asks for one. */
			baseUrl: z.string().optional(),
		}),
		// The service is asked before the write's transaction opens: nothing of the database is held while it answers.
		async prepare(input, ctx) {
			secretOf(ctx);
			const service = serviceOf(ctx, input.service);
			if (!service) throw new CheckError({ key: "keys.unknownService" });
			await mustBeFree(ctx, input.name);
			const baseUrl = service.address ? address(input.baseUrl) : null;
			return { service: service.id, baseUrl, models: await ask(ctx, service, input.secret, baseUrl) };
		},
		async run(input, ctx, asked) {
			// The name was free when the service was asked; it is held and looked at again now that the key goes in.
			await lockName(ctx, input.name);
			await mustBeFree(ctx, input.name);
			const id = randomUUID();
			await ctx.db
				.insertInto("api_keys")
				.values({
					id,
					service: asked.service,
					name: input.name,
					base_url: asked.baseUrl,
					secret: await seal(secretOf(ctx), input.secret, { id, service: asked.service, baseUrl: asked.baseUrl }),
					last4: ending(input.secret),
					models: JSON.stringify(asked.models),
					models_at: ctx.now(),
					created_at: ctx.now(),
				})
				.execute();
			ctx.created({ kind: "key", id });
			return { id, name: input.name, last4: ending(input.secret) };
		},
		summary: (_input, output) => ({ key: "keys.add", values: { name: output.name } }),
	}),
	defineOperation({
		name: "keys.update",
		kind: "write",
		humanOnly: true,
		secretInputs: ["secret"],
		description:
			"Change a key's name, its address, or the key itself. A new key or address is checked with the service again; a key the server can no longer read needs the key entered again. Only a person does it.",
		input: z.object({
			id: z.string(),
			name: Name.optional(),
			/** A new key. Left out, the stored one stays. */
			secret: z.string().trim().optional(),
			baseUrl: z.string().optional(),
		}),
		// Reads the key and asks the service before the transaction opens. `run` then holds the key and goes on only if it is still at the version
		// read here: the key and address that were checked together are the ones stored together, whatever another change did meanwhile.
		async prepare(input, ctx) {
			const secret = secretOf(ctx);
			const key = await ctx.db.selectFrom("api_keys").selectAll().where("id", "=", input.id).executeTakeFirst();
			if (!key) throw new CheckError({ key: "keys.unknown" });
			const name = input.name ?? key.name;
			if (name !== key.name) await mustBeFree(ctx, name, key.id);

			const service = serviceOf(ctx, key.service);
			const baseUrl = service?.address && input.baseUrl !== undefined ? address(input.baseUrl) : key.base_url;
			const stored = await opened(secret, key);
			const next = input.secret ?? stored;
			// A key nobody can read any more is of no use until it is entered again.
			if (next === null) throw new CheckError({ key: "keys.needsKey" });
			const changed = next !== stored || baseUrl !== key.base_url;
			if (changed && !service) throw new CheckError({ key: "keys.unknownService" });
			return {
				version: key.version,
				name,
				baseUrl,
				// The key to seal again: a new key, or the same one under its new address (a sealed key opens only at the address it was sealed for).
				reseal: changed ? next : null,
				models: changed && service ? await ask(ctx, service, next, baseUrl) : null,
			};
		},
		touches: (input) => [{ kind: "key", id: input.id }],
		async run(input, ctx, asked) {
			const key = await ctx.db.selectFrom("api_keys").selectAll().where("id", "=", input.id).executeTakeFirst();
			if (!key) throw new CheckError({ key: "keys.unknown" });
			const changedSince = () =>
				new ConflictError([{ ref: { kind: "key", id: key.id }, expected: asked.version, actual: key.version }]);
			if (key.version !== asked.version) throw changedSince();
			if (asked.name !== key.name) {
				await lockName(ctx, asked.name);
				await mustBeFree(ctx, asked.name, key.id);
			}
			const sealed =
				asked.reseal === null
					? null
					: await seal(secretOf(ctx), asked.reseal, { id: key.id, service: key.service, baseUrl: asked.baseUrl });
			// Written only onto the version that was read before the service was asked: the database itself refuses a change that lost the race.
			const written = await ctx.db
				.updateTable("api_keys")
				.set((eb) => ({
					name: asked.name,
					base_url: asked.baseUrl,
					version: eb("version", "+", 1),
					...(asked.models
						? { models: JSON.stringify(asked.models), models_at: ctx.now(), models_failed_at: null }
						: {}),
					...(sealed !== null && asked.reseal !== null ? { secret: sealed, last4: ending(asked.reseal) } : {}),
				}))
				.where("id", "=", key.id)
				.where("version", "=", asked.version)
				.returning("id")
				.executeTakeFirst();
			if (!written) throw changedSince();
			return { id: key.id, name: asked.name, last4: asked.reseal !== null ? ending(asked.reseal) : key.last4 };
		},
		summary: (_input, output) => ({ key: "keys.update", values: { name: output.name } }),
	}),
	defineOperation({
		name: "keys.remove",
		kind: "write",
		humanOnly: true,
		description:
			"Remove a key for good. What used it stops: `keys.list` tells where a key is used. It cannot be undone. Only a person does it.",
		input: z.object({ id: z.string() }),
		touches: (input) => [{ kind: "key", id: input.id }],
		async run(input, ctx) {
			const removed = await ctx.db
				.deleteFrom("api_keys")
				.where("id", "=", input.id)
				.returning(["id", "name"])
				.executeTakeFirst();
			if (!removed) throw new CheckError({ key: "keys.unknown" });
			return removed;
		},
		summary: (_input, output) => ({ key: "keys.remove", values: { name: output.name } }),
	}),
	defineOperation({
		name: "models.list",
		kind: "read",
		description:
			"The models each key can use (only ones that call tools; each says whether it thinks and reads pictures), the model a new conversation starts with, and the model the quick tasks call. A key's list is asked of its service once a day; `refresh` asks now.",
		input: z.object({ refresh: z.boolean().default(false) }),
		async run(input, ctx): Promise<ModelList> {
			const secret = ctx.site.secret;
			const keys = await readKeys(ctx);
			const now = ctx.now();
			await Promise.all(
				keys.map(async (key) => {
					const service = serviceOf(ctx, key.service);
					if (!key.readable || !service || secret === null) return;
					const fresh = key.models_at !== null && key.models_at.getTime() > now.getTime() - MODELS_FRESH_MS;
					// A service that failed a moment ago is not asked again yet: its last list serves meanwhile.
					const failedLately =
						key.models_failed_at !== null && key.models_failed_at.getTime() > now.getTime() - MODELS_RETRY_MS;
					if (!input.refresh && (fresh || failedLately)) return;
					const plain = await opened(secret, key);
					if (plain === null) return;
					await sharedRefresh(ctx.site, key, async () => {
						const checked = await checkKey(service, { secret: plain, baseUrl: key.base_url }, ctx.site.fetch);
						// The answer belongs to the key and address it was asked with: when the key was changed while the service answered, the answer
						// is dropped, and what the change stored stays.
						await ctx.db
							.updateTable("api_keys")
							.set(
								checked.ok
									? { models: JSON.stringify(checked.models), models_at: now, models_failed_at: null }
									: // A service that does not answer, or answers what cannot be read, keeps the list it gave last.
										{ models_failed_at: now },
							)
							.where("id", "=", key.id)
							.where("secret", "=", key.secret)
							.where("base_url", "is not distinct from", key.base_url)
							.execute();
					});
				}),
			);
			// Read again: what is listed is what is stored now, not what this call happened to hear.
			const stored = await readKeys(ctx);
			return {
				keys: stored
					.filter((key) => usable(ctx, key))
					.map((key) => ({ id: key.id, name: key.name, service: key.service, models: key.models })),
				...(await startingModels(ctx, stored)),
			};
		},
	}),
	defineOperation({
		name: "models.setQuick",
		kind: "write",
		description:
			"Pick the model the quick tasks (fill a field, suggest tags, write alt text) call: one of a key's models.",
		input: z.object({ keyId: z.string(), model: z.string() }),
		async check(input, ctx) {
			const key = (await readKeys(ctx)).find((candidate) => candidate.id === input.keyId);
			if (!key || !usable(ctx, key) || !key.models.some((model) => model.id === input.model))
				throw new CheckError({ key: "models.unknown" });
		},
		async run(input, ctx) {
			await ctx.db
				.insertInto("model_choices")
				.values({ role: "quick", key_id: input.keyId, model: input.model })
				.onConflict((conflict) => conflict.column("role").doUpdateSet({ key_id: input.keyId, model: input.model }))
				.execute();
			return { keyId: input.keyId, model: input.model };
		},
		summary: (input) => ({ key: "models.setQuick", values: { model: input.model } }),
	}),
];

/** A key opened for the server to call its service with (the assistant, a plugin). Nothing an operation returns carries it. */
export type OpenKey = { id: string; service: string; name: string; secret: string; baseUrl: string | null };

/** Opens a key with the server's secret; `null` when there is no such key or the secret does not open it. */
export async function openKey(db: Db, secret: string | null, id: string): Promise<OpenKey | null> {
	if (secret === null) return null;
	const key = await db.selectFrom("api_keys").selectAll().where("id", "=", id).executeTakeFirst();
	const plain = key ? await opened(secret, key) : null;
	return key && plain !== null
		? { id: key.id, service: key.service, name: key.name, secret: plain, baseUrl: key.base_url }
		: null;
}

/**
 * Counts tokens a call spent against its key, in the month the call was made (`at`). Each month has its own count, so a count that arrives late for
 * last month goes to last month and this month's stays. A key that is gone counts nothing, and so does a count that is no number (a service's
 * answer without its usage).
 */
export async function addKeyUsage(db: Db, id: string, tokens: number, at: Date): Promise<void> {
	if (!Number.isFinite(tokens) || tokens <= 0) return;
	const whole = Math.min(Math.round(tokens), Number.MAX_SAFE_INTEGER);
	await db
		.insertInto("api_key_usage")
		.columns(["key_id", "month", "tokens"])
		.expression((eb) =>
			eb
				.selectFrom("api_keys")
				.select(["id", sql<string>`${monthOf(at)}::text`.as("month"), sql<number>`${whole}::bigint`.as("tokens")])
				.where("id", "=", id),
		)
		.onConflict((conflict) =>
			conflict.columns(["key_id", "month"]).doUpdateSet({ tokens: sql`api_key_usage.tokens + excluded.tokens` }),
		)
		.execute();
}
