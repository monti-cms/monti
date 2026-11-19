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

it("SES-CRT-1 issues a session for the right email and password", async () => {
	const before = (await sessionRows()).map((row) => row.token_hash);

	const output = await monti.session.create(owner);
	const added = (await sessionRows()).filter((row) => !before.includes(row.token_hash));

	// SES-CRT-1.1
	expect(output).toEqual({ token: expect.any(String) });
	// SES-CRT-1.2
	expect(added.map((row) => row.token_hash !== output.token)).toEqual([true]);
	// SES-CRT-1.3
	expect(added[0]?.expires_at.getTime()).toBeGreaterThan(Date.now());
});

it("SES-CRT-2 rejects session.create with UNAUTHORIZED for a wrong password", async () => {
	// SES-CRT-2.1
	await expect(monti.session.create({ email: owner.email, password: "wrong password" })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("SES-CRT-3 rejects session.create with UNAUTHORIZED for an unknown email", async () => {
	// SES-CRT-3.1
	await expect(monti.session.create({ email: "nobody@example.com", password: owner.password })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("SES-GET-1 returns the admin for a live token", async () => {
	const { token } = await monti.session.create(owner);

	// SES-GET-1.1
	expect(await monti.session.get({ token })).toEqual({ admin: { id: adminId, email: owner.email } });
});

it("SES-GET-2 returns no admin for an expired token", async () => {
	const expired = await monti.session.create(owner);
	await db
		.updateTable("monti_session")
		.set({ expires_at: new Date(Date.now() - 1000) })
		.where("token_hash", "=", hashToken(expired.token))
		.execute();

	// SES-GET-2.1
	expect(await monti.session.get({ token: expired.token })).toEqual({ admin: null });
});

it("SES-GET-3 returns no admin for a token that does not exist", async () => {
	// SES-GET-3.1
	expect(await monti.session.get({ token: "no-such-token" })).toEqual({ admin: null });
});

it("SES-DEL-1 deletes only the session of the given token", async () => {
	const first = await monti.session.create(owner);
	const second = await monti.session.create(owner);

	await monti.session.delete({ token: first.token });

	// SES-DEL-1.1
	expect(await monti.session.get({ token: first.token })).toEqual({ admin: null });
	// SES-DEL-1.2
	expect(await monti.session.get({ token: second.token })).toEqual({ admin: { id: adminId, email: owner.email } });
});
