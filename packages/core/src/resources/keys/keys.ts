import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { KeyServiceDefinition, ReadContext, WriteContext } from "../../engine/types";
import { decryptSecret, encryptSecret } from "./secret";

/** 키 저장소가 보여 주는 키: 비밀값은 절대 보여 주지 않는다. */
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

const createInput = z.object({ service: z.string().min(1), name: z.string().min(1), secret: z.string().min(1) });

/** `keys.create`: 키의 비밀값을 엔진의 암호화 비밀값(`masterSecret`)으로 암호화해 저장한다. 이름 중복은 DB 고유 제약이 `CONFLICT`로 막는다. */
function createWith(masterSecret: string | undefined) {
	return async function createKey(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<StoredKey> {
		const key = { id: randomUUID(), service: input.service, name: input.name, last4: input.secret.slice(-4) };
		await ctx.db
			.insertInto("api_keys")
			.values({ ...key, secret: encryptSecret(masterSecret, input.secret) })
			.execute();
		return key;
	};
}

const updateInput = z.object({ id: z.string(), name: z.string().min(1), secret: z.string().min(1).optional() });

/** `keys.update`: 이름을 바꾸고, 비밀값이 주어지면 암호화한 비밀값과 `last4`도 바꾼다. */
function updateWith(masterSecret: string | undefined) {
	return async function updateKey(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<StoredKey> {
		const secret =
			input.secret === undefined
				? {}
				: { secret: encryptSecret(masterSecret, input.secret), last4: input.secret.slice(-4) };
		const updated = await ctx.db
			.updateTable("api_keys")
			.set({ name: input.name, ...secret })
			.where("id", "=", input.id)
			.returning(SHOWN)
			.executeTakeFirst();
		if (updated === undefined) throw new MontiError("NOT_FOUND", "이 `id`의 키가 없습니다");
		return updated;
	};
}

const idInput = z.object({ id: z.string() });

async function deleteKey(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<void> {
	const deleted = await ctx.db.deleteFrom("api_keys").where("id", "=", input.id).returning("id").executeTakeFirst();
	if (deleted === undefined) throw new MontiError("NOT_FOUND", "No key has this id");
}

const checkInput = z.union([z.object({ service: z.string(), secret: z.string() }), idInput]);

/** `keys.check`: 플러그인의 키 서비스로 새로 입력한 비밀값이나 저장된 키의 비밀값을 확인한다. */
function checkWith(services: KeyServiceDefinition[], masterSecret: string | undefined) {
	return async function checkKey(input: z.infer<typeof checkInput>, ctx: ReadContext): Promise<{ ok: true }> {
		const { service, secret } = "id" in input ? await storedSecret(ctx.db, masterSecret, input.id) : input;
		const definition = services.find((candidate) => candidate.service === service);
		if (definition === undefined) throw new MontiError("NOT_FOUND", `"${service}" 키를 확인하는 플러그인이 없습니다`);
		try {
			await definition.check(secret);
		} catch {
			throw new MontiError("BAD_REQUEST", `"${service}" 연결 확인이 키를 거절했습니다`);
		}
		return { ok: true };
	};
}

/** 저장된 키의 서비스와, 엔진의 암호화 비밀값으로 복호화한 비밀값. */
async function storedSecret(
	db: ReadContext["db"],
	masterSecret: string | undefined,
	id: string,
): Promise<{ service: string; secret: string }> {
	const row = await db.selectFrom("api_keys").select(["service", "secret"]).where("id", "=", id).executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "이 `id`의 키가 없습니다");
	return { service: row.service, secret: decryptSecret(masterSecret, row.secret) };
}

/**
 * `withStoredKey`: 저장된 키 `key.id`의 복호화한 비밀값을 `use`에 넘기고 `use`의 결과를 돌려준다. 저장된 서비스가
 * `key.service`와 다르면 거절한다. `use`가 던진 오류는 감싸지 않고 그대로 나간다.
 */
function useStoredWith(masterSecret: string | undefined) {
	return async function withStoredKey<T>(
		db: ReadContext["db"],
		key: { id: string; service: string },
		use: (apiKey: string) => Promise<T>,
	): Promise<T> {
		const { service, secret } = await storedSecret(db, masterSecret, key.id);
		if (service !== key.service) throw new MontiError("BAD_REQUEST", `이 키는 "${key.service}" 서비스의 키가 아닙니다`);
		return use(secret);
	};
}

const list = defineRead({ input: z.object({}), run: listKeys });
const remove = defineWrite({ input: idInput, run: deleteKey });

/**
 * `keys` 리소스(`resource`)와, 서버 코드가 저장된 키의 비밀값을 꺼내 쓰는 `withStoredKey`. `check`는 플러그인이 등록한 키
 * 서비스를 쓴다. 암호화 비밀값(`secret`)은 설정(`ctx.config`)에 두지 않고 이 클로저에만 담아, 키를 암호화·복호화하는
 * 작업만 쓴다. `withStoredKey`는 Operation이 아니어서 명세에 나오지 않고, 읽을 DB를 첫 인자로 받는다.
 */
export function createKeys(services: KeyServiceDefinition[], secret?: string) {
	const create = defineWrite({ input: createInput, run: createWith(secret) });
	const update = defineWrite({ input: updateInput, run: updateWith(secret) });
	const check = defineRead({ input: checkInput, run: checkWith(services, secret) });
	return { resource: { list, create, update, delete: remove, check }, withStoredKey: useStoredWith(secret) };
}
