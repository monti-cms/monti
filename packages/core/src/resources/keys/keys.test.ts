import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { keyServicesOf } from "../../engine/plugins";
import type { Plugin } from "../../engine/types";
import { createKeys } from "./keys";

let testDb: TestDatabase;
let db: Kysely<Database>;

function montiOf(plugins: Plugin[]) {
	return createMonti(db, { keys: createKeys(keyServicesOf(plugins)) }, plugins);
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
	await migrate(testDb.db, "core", [initial]);
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

it("KEY-1 encrypts and stores a key and returns its last four characters", async () => {
	const monti = montiOf([]);

	const output = await monti.keys.create(mailKey);
	const rows = await keyRows();

	// KEY-1.1
	expect(output).toMatchObject({ id: expect.any(String), service: mailKey.service, name: mailKey.name });
	// KEY-1.2
	expect(output.last4).toBe("1234");
	// KEY-1.3
	expect(output).not.toHaveProperty("secret");
	// KEY-1.4
	expect(rows.map((row) => row.id)).toEqual([output.id]);
	// KEY-1.5
	expect(rows[0]?.secret).not.toBe(mailKey.secret);
});

it("KEY-2 rejects keys.create with CONFLICT for a name already taken", async () => {
	const monti = montiOf([]);
	await monti.keys.create(mailKey);

	// KEY-2.1
	await expect(monti.keys.create({ ...storageKey, name: mailKey.name })).rejects.toMatchObject({ code: "CONFLICT" });
	// KEY-2.2
	expect(await keyRows()).toHaveLength(1);
});

it("KEY-3 lists only the id, service, name and last4 of the stored keys", async () => {
	const monti = montiOf([]);
	const mail = await monti.keys.create(mailKey);
	const storage = await monti.keys.create(storageKey);

	const output = await monti.keys.list({});

	// KEY-3.1
	expect([...output].sort(byName)).toEqual([
		{ id: mail.id, service: "mail", name: "Mail", last4: "1234" },
		{ id: storage.id, service: "storage", name: "Storage", last4: "5678" },
	]);
	// KEY-3.2
	expect(output.filter((item) => "secret" in item)).toEqual([]);
});

it("KEY-4 changes both the name and the secret when keys.update gets a new secret", async () => {
	const monti = montiOf([mailPlugin]);
	const { id } = await monti.keys.create(mailKey);

	const output = await monti.keys.update({ id, name: "Mail renamed", secret: "new-secret-9999" });
	const rows = await keyRows();
	await monti.keys.check({ id });

	// KEY-4.1
	expect(output.name).toBe("Mail renamed");
	// KEY-4.2
	expect(output.last4).toBe("9999");
	// KEY-4.3
	expect(rows.map((row) => [row.name, row.last4])).toEqual([["Mail renamed", "9999"]]);
	// KEY-4.4
	expect(passing.mock.calls).toEqual([["new-secret-9999"]]);
});

it("KEY-5 changes only the name and keeps the secret when keys.update gets no secret", async () => {
	const monti = montiOf([mailPlugin]);
	const { id } = await monti.keys.create(mailKey);

	const output = await monti.keys.update({ id, name: "Mail renamed" });
	const rows = await keyRows();
	await monti.keys.check({ id });

	// KEY-5.1
	expect(output.name).toBe("Mail renamed");
	// KEY-5.2
	expect(output.last4).toBe("1234");
	// KEY-5.3
	expect(rows.map((row) => row.name)).toEqual(["Mail renamed"]);
	// KEY-5.4
	expect(passing.mock.calls).toEqual([[mailKey.secret]]);
});

it("KEY-6 rejects keys.update with CONFLICT for a name another key has", async () => {
	const monti = montiOf([]);
	await monti.keys.create(mailKey);
	const second = await monti.keys.create(storageKey);

	// KEY-6.1
	await expect(monti.keys.update({ id: second.id, name: mailKey.name })).rejects.toMatchObject({ code: "CONFLICT" });
	const rows = await db.selectFrom("api_keys").select("name").where("id", "=", second.id).execute();
	// KEY-6.2
	expect(rows.map((row) => row.name)).toEqual([storageKey.name]);
});

it("KEY-7 rejects keys.update with NOT_FOUND for an id that does not exist", async () => {
	const monti = montiOf([]);

	// KEY-7.1
	await expect(monti.keys.update({ id: "no-such-key", name: "Mail" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("KEY-8 deletes only the key of the given id", async () => {
	const monti = montiOf([]);
	const first = await monti.keys.create(mailKey);
	const second = await monti.keys.create(storageKey);

	await monti.keys.delete({ id: first.id });

	// KEY-8.1
	expect((await keyRows()).map((row) => row.id)).toEqual([second.id]);
});

it("KEY-9 rejects keys.delete with NOT_FOUND for an id that does not exist", async () => {
	const monti = montiOf([]);

	// KEY-9.1
	await expect(monti.keys.delete({ id: "no-such-key" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("KEY-10 runs the plugin's check function with the given service and secret", async () => {
	const monti = montiOf([mailPlugin]);

	const output = await monti.keys.check({ service: "mail", secret: "typed-secret" });

	// KEY-10.1
	expect(passing.mock.calls).toEqual([["typed-secret"]]);
	// KEY-10.2
	expect(output).toEqual({ ok: true });
});

it("KEY-11 decrypts the stored secret and runs the check function for a stored key's id", async () => {
	const monti = montiOf([mailPlugin]);
	const { id } = await monti.keys.create(mailKey);

	const output = await monti.keys.check({ id });

	// KEY-11.1
	expect(passing.mock.calls).toEqual([[mailKey.secret]]);
	// KEY-11.2
	expect(output).toEqual({ ok: true });
});

it("KEY-12 rejects keys.check with BAD_REQUEST when the check function rejects", async () => {
	const monti = montiOf([refusingPlugin]);

	// KEY-12.1
	await expect(monti.keys.check({ service: "mail", secret: "typed-secret" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("KEY-13 rejects keys.check with NOT_FOUND for a service no plugin registers", async () => {
	const monti = montiOf([servicelessPlugin]);

	// KEY-13.1
	await expect(monti.keys.check({ service: "mail", secret: "typed-secret" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("KEY-14 rejects keys.check with NOT_FOUND for an id that does not exist", async () => {
	const monti = montiOf([mailPlugin]);

	// KEY-14.1
	await expect(monti.keys.check({ id: "no-such-key" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
