import { type Kysely, type Selectable, sql, type Transaction } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import type { ApiKeyTable, Database } from "../db/schema";
import { CheckError } from "../errors";
import { defineOperation, type OperationContext } from "../operation";
import { seal, unseal } from "./seal";
import type { KeyService, Model } from "./services";

type Db = Kysely<Database> | Transaction<Database>;
type KeyRecord = Selectable<ApiKeyTable>;

/** How long a key's model list is kept before the service is asked again. */
const MODELS_FRESH_MS = 86_400_000;
/** A key shorter than this shows no ending: four characters would be too much of it. */
const SHOWS_ENDING = 12;

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

const ending = (secret: string) => (secret.length >= SHOWS_ENDING ? secret.slice(-4) : "");

const serviceOf = (ctx: OperationContext, id: string) => ctx.site.keyServices.find((service) => service.id === id);

const keysInOrder = (db: Db): Promise<KeyRecord[]> =>
	db.selectFrom("api_keys").selectAll().orderBy("created_at").orderBy("id").execute();

/** Each key with whether the server's secret opens it. */
async function readKeys(ctx: OperationContext) {
	const secret = ctx.site.secret;
	return Promise.all(
		(await keysInOrder(ctx.db)).map(async (key) => ({
			...key,
			readable: secret !== null && (await unseal(secret, key.secret)) !== null,
		})),
	);
}

/** The first of the service's preferred models the key can use, or the key's first model. */
const preferred = (models: Model[], wanted: string[] | undefined) =>
	wanted?.find((id) => models.some((model) => model.id === id)) ?? models[0]?.id;

/** The models at work before and after anyone picks (doc 10: a new conversation starts with the first key's service's default). */
async function startingModels(
	ctx: OperationContext,
	keys: (KeyRecord & { readable: boolean })[],
): Promise<Pick<ModelList, "assistant" | "quick">> {
	const usable = keys.filter((key) => key.readable && key.models.length > 0);
	const first = usable[0];
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
		picked && usable.some((key) => key.id === picked.key_id && key.models.some((model) => model.id === picked.model));
	const builtIn = own("quick");
	return {
		assistant: own("assistant"),
		quick: stillThere
			? { keyId: picked.key_id, model: picked.model, chosen: true }
			: builtIn && { ...builtIn, chosen: false },
	};
}

/** A service's address as it is stored: an http(s) address without the trailing slash. */
function address(raw: string | undefined): string {
	let url: URL | null = null;
	try {
		url = new URL((raw ?? "").trim());
	} catch {}
	if (!url || !["http:", "https:"].includes(url.protocol)) throw new CheckError({ key: "keys.badAddress" });
	return url.toString().replace(/\/+$/, "");
}

/** Asks the service once whether it takes the key (doc 14: on add, and again whenever the key or its address changes). */
async function ask(ctx: OperationContext, service: KeyService, secret: string, baseUrl: string | null) {
	if (secret === "" && !service.keyOptional) throw new CheckError({ key: "keys.needsKey" });
	const checked = await service.check({ secret, baseUrl }, ctx.site.fetch);
	if (!checked.ok) throw new CheckError({ key: checked.reason === "refused" ? "keys.refused" : "keys.unreachable" });
	return checked.models;
}

async function mustBeFree(ctx: OperationContext, name: string, except?: string) {
	const taken = await ctx.db.selectFrom("api_keys").select("id").where("name", "=", name).executeTakeFirst();
	if (taken && taken.id !== except) throw new CheckError({ key: "keys.nameTaken", values: { name } });
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
					usage: { month, tokens: key.usage_month === month ? Number(key.usage_tokens) : 0 },
					uses: [
						...(assistant?.keyId === key.id ? [{ for: "assistant" as const, model: assistant.model }] : []),
						...(quick?.keyId === key.id ? [{ for: "quick" as const, model: quick.model }] : []),
					],
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
		async run(input, ctx) {
			const secret = ctx.site.secret;
			if (secret === null) throw new CheckError({ key: "keys.noSecret" });
			const service = serviceOf(ctx, input.service);
			if (!service) throw new CheckError({ key: "keys.unknownService" });
			await mustBeFree(ctx, input.name);
			const baseUrl = service.address ? address(input.baseUrl) : null;
			const models = await ask(ctx, service, input.secret, baseUrl);
			const id = randomUUID();
			await ctx.db
				.insertInto("api_keys")
				.values({
					id,
					service: service.id,
					name: input.name,
					base_url: baseUrl,
					secret: await seal(secret, input.secret),
					last4: ending(input.secret),
					models: JSON.stringify(models),
					models_at: ctx.now(),
					usage_month: monthOf(ctx.now()),
					created_at: ctx.now(),
				})
				.execute();
			return { id, name: input.name, last4: ending(input.secret) };
		},
		summary: (_input, output) => ({ key: "keys.add", values: { name: output.name } }),
	}),
	defineOperation({
		name: "keys.update",
		kind: "write",
		humanOnly: true,
		description:
			"Change a key's name, its address, or the key itself. A new key or address is checked with the service again; a key the server can no longer read needs the key entered again. Only a person does it.",
		input: z.object({
			id: z.string(),
			name: Name.optional(),
			/** A new key. Left out, the stored one stays. */
			secret: z.string().trim().optional(),
			baseUrl: z.string().optional(),
		}),
		async run(input, ctx) {
			const secret = ctx.site.secret;
			if (secret === null) throw new CheckError({ key: "keys.noSecret" });
			const key = await ctx.db.selectFrom("api_keys").selectAll().where("id", "=", input.id).executeTakeFirst();
			if (!key) throw new CheckError({ key: "keys.unknown" });
			const name = input.name ?? key.name;
			if (name !== key.name) await mustBeFree(ctx, name, key.id);

			const service = serviceOf(ctx, key.service);
			const baseUrl = service?.address && input.baseUrl !== undefined ? address(input.baseUrl) : key.base_url;
			const stored = await unseal(secret, key.secret);
			const next = input.secret ?? stored;
			// A key nobody can read any more is of no use until it is entered again.
			if (next === null) throw new CheckError({ key: "keys.needsKey" });
			const changed = next !== stored || baseUrl !== key.base_url;
			if (changed && !service) throw new CheckError({ key: "keys.unknownService" });
			const models = changed && service ? await ask(ctx, service, next, baseUrl) : null;

			await ctx.db
				.updateTable("api_keys")
				.set({
					name,
					base_url: baseUrl,
					...(models ? { models: JSON.stringify(models), models_at: ctx.now() } : {}),
					...(next !== stored ? { secret: await seal(secret, next), last4: ending(next) } : {}),
				})
				.where("id", "=", key.id)
				.execute();
			return { id: key.id, name, last4: next !== stored ? ending(next) : key.last4 };
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
			const stale = ctx.now().getTime() - MODELS_FRESH_MS;
			await Promise.all(
				keys.map(async (key) => {
					const service = serviceOf(ctx, key.service);
					if (!key.readable || !service || secret === null) return;
					if (!input.refresh && key.models_at !== null && key.models_at.getTime() > stale) return;
					const opened = await unseal(secret, key.secret);
					if (opened === null) return;
					const checked = await service.check({ secret: opened, baseUrl: key.base_url }, ctx.site.fetch);
					// A service that does not answer now keeps the list it gave last.
					if (!checked.ok) return;
					key.models = checked.models;
					key.models_at = ctx.now();
					await ctx.db
						.updateTable("api_keys")
						.set({ models: JSON.stringify(checked.models), models_at: key.models_at })
						.where("id", "=", key.id)
						.execute();
				}),
			);
			return {
				keys: keys
					.filter((key) => key.readable)
					.map((key) => ({ id: key.id, name: key.name, service: key.service, models: key.models })),
				...(await startingModels(ctx, keys)),
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
			if (!key?.readable || !key.models.some((model) => model.id === input.model))
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
	const opened = key ? await unseal(secret, key.secret) : null;
	return key && opened !== null
		? { id: key.id, service: key.service, name: key.name, secret: opened, baseUrl: key.base_url }
		: null;
}

/** Counts tokens a call spent against its key, in the month the call was made. A new month starts from nothing. */
export async function addKeyUsage(db: Db, id: string, tokens: number, at: Date): Promise<void> {
	const month = monthOf(at);
	await db
		.updateTable("api_keys")
		.set({
			usage_tokens: sql`case when usage_month = ${month} then usage_tokens else 0 end + ${Math.max(0, Math.round(tokens))}`,
			usage_month: month,
		})
		.where("id", "=", id)
		.execute();
}
