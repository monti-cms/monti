import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { KeyServiceDefinition, ReadContext, WriteContext } from "../../engine/types";
import { decryptSecret, encryptSecret } from "./secret";

/** What the key store shows of a key: never its secret. */
interface StoredKey {
	id: string;
	service: string;
	name: string;
	last4: string;
}

const SHOWN = ["id", "service", "name", "last4"] as const;

async function listKeys(_input: unknown, ctx: ReadContext): Promise<StoredKey[]> {
	return ctx.db.selectFrom("api_keys").select(SHOWN).execute();
}

const createInput = z.object({ service: z.string(), name: z.string(), secret: z.string() });

async function createKey(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<StoredKey> {
	const key = { id: randomUUID(), service: input.service, name: input.name, last4: input.secret.slice(-4) };
	await rejectTakenName(ctx, key.name, key.id);
	await ctx.db
		.insertInto("api_keys")
		.values({ ...key, secret: encryptSecret(input.secret) })
		.execute();
	return key;
}

const updateInput = z.object({ id: z.string(), name: z.string(), secret: z.string().optional() });

/** Renames the key; a given secret also replaces the stored one and its `last4`. */
async function updateKey(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<StoredKey> {
	await rejectTakenName(ctx, input.name, input.id);
	const secret =
		input.secret === undefined ? {} : { secret: encryptSecret(input.secret), last4: input.secret.slice(-4) };
	const updated = await ctx.db
		.updateTable("api_keys")
		.set({ name: input.name, ...secret })
		.where("id", "=", input.id)
		.returning(SHOWN)
		.executeTakeFirst();
	if (updated === undefined) throw new MontiError("NOT_FOUND", "No key has this id");
	return updated;
}

/** Rejects a name another key than `exceptId` already has. */
async function rejectTakenName(ctx: WriteContext, name: string, exceptId: string): Promise<void> {
	const taken = await ctx.db
		.selectFrom("api_keys")
		.select("id")
		.where("name", "=", name)
		.where("id", "<>", exceptId)
		.executeTakeFirst();
	if (taken !== undefined) throw new MontiError("CONFLICT", "Another key has this name");
}

const idInput = z.object({ id: z.string() });

async function deleteKey(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<void> {
	const deleted = await ctx.db.deleteFrom("api_keys").where("id", "=", input.id).returning("id").executeTakeFirst();
	if (deleted === undefined) throw new MontiError("NOT_FOUND", "No key has this id");
}

const checkInput = z.union([z.object({ service: z.string(), secret: z.string() }), idInput]);

/** `keys.check` over the plugins' key services: runs the service's check on a typed secret or a stored key's secret. */
function checkWith(services: KeyServiceDefinition[]) {
	return async function checkKey(input: z.infer<typeof checkInput>, ctx: ReadContext): Promise<{ ok: true }> {
		const { service, secret } = "id" in input ? await storedSecret(ctx, input.id) : input;
		const definition = services.find((candidate) => candidate.service === service);
		if (definition === undefined) throw new MontiError("NOT_FOUND", `No plugin checks keys of "${service}"`);
		try {
			await definition.check(secret);
		} catch {
			throw new MontiError("BAD_REQUEST", `The "${service}" check rejected the key`);
		}
		return { ok: true };
	};
}

async function storedSecret(ctx: ReadContext, id: string): Promise<{ service: string; secret: string }> {
	const row = await ctx.db.selectFrom("api_keys").select(["service", "secret"]).where("id", "=", id).executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "No key has this id");
	return { service: row.service, secret: decryptSecret(row.secret) };
}

const list = defineRead({ input: z.object({}), run: listKeys });
const create = defineWrite({ input: createInput, run: createKey });
const update = defineWrite({ input: updateInput, run: updateKey });
const remove = defineWrite({ input: idInput, run: deleteKey });

/** The `keys` resource; `check` uses the key services the plugins register. */
export function createKeys(services: KeyServiceDefinition[]) {
	const check = defineRead({ input: checkInput, run: checkWith(services) });
	return { list, create, update, delete: remove, check };
}
