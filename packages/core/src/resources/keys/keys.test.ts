import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { codeOf, overlap } from "../../__test__/race";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { keyServicesOf } from "../../engine/plugins";
import type { Plugin } from "../../engine/types";
import { createKeys } from "./keys";

let testDb: TestDatabase;
let db: Kysely<Database>;

const SECRET = "test monti secret";

/** `secret`을 암호화 비밀값으로 쓰는 엔진. `null`을 주면 암호화 비밀값이 없다. */
function montiOf(plugins: Plugin[], secret: string | null = SECRET) {
	return createMonti(db, { keys: createKeys(keyServicesOf(plugins), secret ?? undefined).resource }, plugins, {
		schema: { locales: ["ko"], collections: {} },
		config: { name: "Monti Blog", dev: false },
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

const passing = vi.fn<(secret: string) => Promise<void>>();
const rejecting = vi.fn<(secret: string) => Promise<void>>();
const otherService = vi.fn<(secret: string) => Promise<void>>();

const mailPlugin: Plugin = {
	name: "mail-plugin",
	keyServices: [
		{ service: "storage", check: otherService },
		{ service: "mail", check: passing },
	],
};
const refusingPlugin: Plugin = { name: "refusing-plugin", keyServices: [{ service: "mail", check: rejecting }] };
const servicelessPlugin: Plugin = { name: "serviceless-plugin" };

const mailKey = { service: "mail", name: "Mail", secret: "mail-secret-1234" };
const storageKey = { service: "storage", name: "Storage", secret: "storage-secret-5678" };

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "@monti-cms/core", [initial]);
	db = testDb.db as Kysely<Database>;
	passing.mockReset().mockResolvedValue(undefined);
	rejecting.mockReset().mockRejectedValue(new Error("connection refused"));
});

afterEach(async () => {
	await testDb.drop();
});

async function keyRows() {
	return db.selectFrom("api_keys").selectAll().execute();
}

function byName(a: { name: string }, b: { name: string }): number {
	return a.name < b.name ? -1 : 1;
}

it("KEY-CRT-1 encrypts and stores a key and returns its last four characters", async () => {
	const monti = montiOf([]);

	const output = await monti.keys.create(mailKey);
	const rows = await keyRows();

	// KEY-CRT-1.1
	expect(output).toMatchObject({ id: expect.any(String), service: mailKey.service, name: mailKey.name });
	// KEY-CRT-1.2
	expect(output.last4).toBe("1234");
	// KEY-CRT-1.3
	expect(output).not.toHaveProperty("secret");
	// KEY-CRT-1.4
	expect(rows.map((row) => row.id)).toEqual([output.id]);
	// KEY-CRT-1.5
	expect(rows[0]?.secret).not.toBe(mailKey.secret);
});

it("KEY-CRT-2 rejects keys.create with CONFLICT for a name already taken", async () => {
	const monti = montiOf([]);
	await monti.keys.create(mailKey);

	// KEY-CRT-2.1
	await expect(monti.keys.create({ ...storageKey, name: mailKey.name })).rejects.toMatchObject({ code: "CONFLICT" });
	// KEY-CRT-2.2
	expect(await keyRows()).toHaveLength(1);
});

it("KEY-CRT-3 암호화 비밀값이 없으면 키를 저장할 수 없다", async () => {
	const monti = montiOf([], null);

	// KEY-CRT-3.1
	await expect(monti.keys.create(mailKey)).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// KEY-CRT-3.2
	expect(await keyRows()).toEqual([]);
});

it("KEY-CRT-4 서비스·이름·비밀값 중 하나라도 빈 문자열이면 키를 저장할 수 없다", async () => {
	const monti = montiOf([]);

	const codes = [
		await codeOf(monti.keys.create({ ...mailKey, service: "" })),
		await codeOf(monti.keys.create({ ...mailKey, name: "" })),
		await codeOf(monti.keys.create({ ...mailKey, secret: "" })),
	];

	// KEY-CRT-4.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
	// KEY-CRT-4.2
	expect(await keyRows()).toEqual([]);
});

it("KEY-LST-1 lists only the id, service, name and last4 of the stored keys", async () => {
	const monti = montiOf([]);
	const mail = await monti.keys.create(mailKey);
	const storage = await monti.keys.create(storageKey);

	const output = await monti.keys.list({});

	// KEY-LST-1.1
	expect([...output].sort(byName)).toEqual([
		{ id: mail.id, service: "mail", name: "Mail", last4: "1234" },
		{ id: storage.id, service: "storage", name: "Storage", last4: "5678" },
	]);
	// KEY-LST-1.2
	expect(output.filter((item) => "secret" in item)).toEqual([]);
});

it("KEY-UPD-1 changes both the name and the secret when keys.update gets a new secret", async () => {
	const monti = montiOf([mailPlugin]);
	const { id } = await monti.keys.create(mailKey);

	const output = await monti.keys.update({ id, name: "Mail renamed", secret: "new-secret-9999" });
	const rows = await keyRows();
	await monti.keys.check({ id });

	// KEY-UPD-1.1
	expect(output.name).toBe("Mail renamed");
	// KEY-UPD-1.2
	expect(output.last4).toBe("9999");
	// KEY-UPD-1.3
	expect(rows.map((row) => [row.name, row.last4])).toEqual([["Mail renamed", "9999"]]);
	// KEY-UPD-1.4
	expect(passing.mock.calls).toEqual([["new-secret-9999"]]);
});

it("KEY-UPD-2 changes only the name and keeps the secret when keys.update gets no secret", async () => {
	const monti = montiOf([mailPlugin]);
	const { id } = await monti.keys.create(mailKey);

	const output = await monti.keys.update({ id, name: "Mail renamed" });
	const rows = await keyRows();
	await monti.keys.check({ id });

	// KEY-UPD-2.1
	expect(output.name).toBe("Mail renamed");
	// KEY-UPD-2.2
	expect(output.last4).toBe("1234");
	// KEY-UPD-2.3
	expect(rows.map((row) => row.name)).toEqual(["Mail renamed"]);
	// KEY-UPD-2.4
	expect(passing.mock.calls).toEqual([[mailKey.secret]]);
});

it("KEY-UPD-3 rejects keys.update with CONFLICT for a name another key has", async () => {
	const monti = montiOf([]);
	await monti.keys.create(mailKey);
	const second = await monti.keys.create(storageKey);

	// KEY-UPD-3.1
	await expect(monti.keys.update({ id: second.id, name: mailKey.name })).rejects.toMatchObject({ code: "CONFLICT" });
	const rows = await db.selectFrom("api_keys").select("name").where("id", "=", second.id).execute();
	// KEY-UPD-3.2
	expect(rows.map((row) => row.name)).toEqual([storageKey.name]);
});

it("KEY-UPD-4 rejects keys.update with NOT_FOUND for an id that does not exist", async () => {
	const monti = montiOf([]);

	// KEY-UPD-4.1
	await expect(monti.keys.update({ id: "no-such-key", name: "Mail" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("KEY-UPD-5 암호화 비밀값이 없으면 저장된 키의 비밀값을 바꿀 수 없다", async () => {
	const stored = await montiOf([]).keys.create(mailKey);
	const before = await keyRows();
	const monti = montiOf([], null);

	// KEY-UPD-5.1
	await expect(
		monti.keys.update({ id: stored.id, name: "Mail renamed", secret: "new-secret-9999" }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// KEY-UPD-5.2
	expect(await keyRows()).toEqual(before);
});

it("KEY-UPD-6 이름이나 비밀값을 빈 문자열로 바꿀 수 없다", async () => {
	const monti = montiOf([]);
	const { id } = await monti.keys.create(mailKey);
	const before = await keyRows();

	const codes = [
		await codeOf(monti.keys.update({ id, name: "" })),
		await codeOf(monti.keys.update({ id, name: mailKey.name, secret: "" })),
	];

	// KEY-UPD-6.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// KEY-UPD-6.2
	expect(await keyRows()).toEqual(before);
});

it("KEY-DEL-1 deletes only the key of the given id", async () => {
	const monti = montiOf([]);
	const first = await monti.keys.create(mailKey);
	const second = await monti.keys.create(storageKey);

	await monti.keys.delete({ id: first.id });

	// KEY-DEL-1.1
	expect((await keyRows()).map((row) => row.id)).toEqual([second.id]);
});

it("KEY-DEL-2 rejects keys.delete with NOT_FOUND for an id that does not exist", async () => {
	const monti = montiOf([]);

	// KEY-DEL-2.1
	await expect(monti.keys.delete({ id: "no-such-key" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("KEY-CHK-1 runs the plugin's check function with the given service and secret", async () => {
	const monti = montiOf([mailPlugin]);

	const output = await monti.keys.check({ service: "mail", secret: "typed-secret" });

	// KEY-CHK-1.1
	expect(passing.mock.calls).toEqual([["typed-secret"]]);
	// KEY-CHK-1.2
	expect(output).toEqual({ ok: true });
});

it("KEY-CHK-2 decrypts the stored secret and runs the check function for a stored key's id", async () => {
	const monti = montiOf([mailPlugin]);
	const { id } = await monti.keys.create(mailKey);

	const output = await monti.keys.check({ id });

	// KEY-CHK-2.1
	expect(passing.mock.calls).toEqual([[mailKey.secret]]);
	// KEY-CHK-2.2
	expect(output).toEqual({ ok: true });
});

it("KEY-CHK-3 rejects keys.check with BAD_REQUEST when the check function rejects", async () => {
	const monti = montiOf([refusingPlugin]);

	// KEY-CHK-3.1
	await expect(monti.keys.check({ service: "mail", secret: "typed-secret" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("KEY-CHK-4 rejects keys.check with NOT_FOUND for a service no plugin registers", async () => {
	const monti = montiOf([servicelessPlugin]);

	// KEY-CHK-4.1
	await expect(monti.keys.check({ service: "mail", secret: "typed-secret" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("KEY-CHK-5 rejects keys.check with NOT_FOUND for an id that does not exist", async () => {
	const monti = montiOf([mailPlugin]);

	// KEY-CHK-5.1
	await expect(monti.keys.check({ id: "no-such-key" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("KEY-CHK-6 암호화 비밀값이 없으면 저장된 키 ID로 연결을 확인할 수 없다", async () => {
	const stored = await montiOf([mailPlugin]).keys.create(mailKey);
	const monti = montiOf([mailPlugin], null);

	// KEY-CHK-6.1
	await expect(monti.keys.check({ id: stored.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("KEY-CRT-5 같은 이름으로 키를 동시에 두 번 만들면 한 건만 성공하고 나머지는 거절된다", async () => {
	const monti = montiOf([]);

	// 첫 생성을 커밋 직전에 멈춰 두고 두 번째 생성을 시작한다.
	const [first, second] = await overlap(
		db,
		(hold) =>
			monti.transaction(async (tx) => {
				const created = await tx.keys.create(mailKey);
				await hold();
				return created;
			}),
		() => monti.keys.create({ ...mailKey, secret: "other-secret-0000" }),
	);

	// KEY-CRT-5.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// KEY-CRT-5.2
	expect((await keyRows()).filter((row) => row.name === mailKey.name)).toHaveLength(1);
});

it("KEY-CHK-7 저장할 때와 다른 암호화 비밀값으로는 저장된 키의 연결을 확인할 수 없다", async () => {
	const [firstSecret, secondSecret] = ["first monti secret", "second monti secret"];
	const stored = await montiOf([mailPlugin], firstSecret).keys.create(mailKey);
	const monti = montiOf([mailPlugin], secondSecret);

	const error = await monti.keys.check({ id: stored.id }).then(
		() => undefined,
		(thrown: { code?: string; message?: string; details?: unknown }) => thrown,
	);
	const shown = JSON.stringify({ message: error?.message, details: error?.details });

	// KEY-CHK-7.1
	expect(error?.code).toBe("BAD_REQUEST");
	// KEY-CHK-7.2
	expect(passing).not.toHaveBeenCalled();
	// KEY-CHK-7.3
	expect([mailKey.secret, firstSecret, secondSecret].filter((secret) => shown.includes(secret))).toEqual([]);
});
