import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { admin } from "../admin/admin";
import { hashToken } from "./issue";
import { session } from "./session";

let testDb: TestDatabase;
let db: Kysely<Database>;

function montiOf(database: Kysely<Database>) {
	return createMonti(database, { admin, session });
}

let monti: ReturnType<typeof montiOf>;
let adminId: string;

const owner = { email: "owner@example.com", password: "correct horse battery staple" };

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	monti = montiOf(db);
	adminId = (await monti.admin.create(owner)).id;
});

afterEach(async () => {
	await testDb.drop();
});

async function sessionRows() {
	return db.selectFrom("monti_session").selectAll().execute();
}

it("AUTH-5 issues a session for the right email and password", async () => {
	const before = (await sessionRows()).map((row) => row.token_hash);

	const output = await monti.session.create(owner);
	const added = (await sessionRows()).filter((row) => !before.includes(row.token_hash));

	// AUTH-5.1
	expect(output).toEqual({ token: expect.any(String) });
	// AUTH-5.2
	expect(added.map((row) => row.token_hash !== output.token)).toEqual([true]);
	// AUTH-5.3
	expect(added[0]?.expires_at.getTime()).toBeGreaterThan(Date.now());
});

it("AUTH-6 rejects session.create with UNAUTHORIZED for a wrong password", async () => {
	// AUTH-6.1
	await expect(monti.session.create({ email: owner.email, password: "wrong password" })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("AUTH-7 rejects session.create with UNAUTHORIZED for an unknown email", async () => {
	// AUTH-7.1
	await expect(monti.session.create({ email: "nobody@example.com", password: owner.password })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("AUTH-8 returns the admin for a live token", async () => {
	const { token } = await monti.session.create(owner);

	// AUTH-8.1
	expect(await monti.session.get({ token })).toEqual({ admin: { id: adminId, email: owner.email } });
});

it("AUTH-9 returns no admin for an expired token", async () => {
	const expired = await monti.session.create(owner);
	await db
		.updateTable("monti_session")
		.set({ expires_at: new Date(Date.now() - 1000) })
		.where("token_hash", "=", hashToken(expired.token))
		.execute();

	// AUTH-9.1
	expect(await monti.session.get({ token: expired.token })).toEqual({ admin: null });
});

it("AUTH-10 returns no admin for a token that does not exist", async () => {
	// AUTH-10.1
	expect(await monti.session.get({ token: "no-such-token" })).toEqual({ admin: null });
});

it("AUTH-11 deletes only the session of the given token", async () => {
	const first = await monti.session.create(owner);
	const second = await monti.session.create(owner);

	await monti.session.delete({ token: first.token });

	// AUTH-11.1
	expect(await monti.session.get({ token: first.token })).toEqual({ admin: null });
	// AUTH-11.2
	expect(await monti.session.get({ token: second.token })).toEqual({ admin: { id: adminId, email: owner.email } });
});
