import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import { session } from "../session/session";
import { admin } from "./admin";

let testDb: TestDatabase;
let db: Kysely<Database>;

function montiOf(database: Kysely<Database>) {
	return createMonti(database, { admin, session });
}

let monti: ReturnType<typeof montiOf>;

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	monti = montiOf(db);
});

afterEach(async () => {
	await testDb.drop();
});

const owner = { email: "owner@example.com", password: "correct horse battery staple" };

it("AUTH-1 creates the first admin and a session when there is no admin", async () => {
	const output = await monti.admin.create(owner);
	const rows = await db.selectFrom("monti_admin").selectAll().where("email", "=", owner.email).execute();

	// AUTH-1.1
	expect(output).toMatchObject({ id: rows[0]?.id, email: owner.email });
	// AUTH-1.2
	expect(output.token).toEqual(expect.any(String));
	// AUTH-1.3
	expect(rows).toHaveLength(1);
	// AUTH-1.4
	expect(rows[0]?.password_hash).not.toBe(owner.password);
	// AUTH-1.5
	expect(await monti.session.get({ token: output.token })).toEqual({ admin: { id: output.id, email: owner.email } });
});

it("AUTH-2 rejects admin.create with CONFLICT when an admin already exists", async () => {
	await monti.admin.create(owner);

	// AUTH-2.1
	await expect(monti.admin.create({ email: "other@example.com", password: "another" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// AUTH-2.2
	expect(await db.selectFrom("monti_admin").select("email").execute()).toEqual([{ email: owner.email }]);
});

const changed = { email: "new@example.com", password: "a new password" };

it("AUTH-3 changes the email and password and deletes every session when the current password is right", async () => {
	await monti.admin.create(owner);
	await monti.session.create(owner);

	const output = await monti.admin.update({ currentPassword: owner.password, ...changed });
	const sessions = await db.selectFrom("monti_session").selectAll().execute();

	// AUTH-3.1
	expect(output.email).toBe(changed.email);
	// AUTH-3.2
	expect(sessions).toEqual([]);
	// AUTH-3.3
	expect(await monti.session.create(changed)).toEqual({ token: expect.any(String) });
	// AUTH-3.4
	await expect(monti.session.create({ email: changed.email, password: owner.password })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("AUTH-4 rejects admin.update with UNAUTHORIZED when the current password is wrong", async () => {
	await monti.admin.create(owner);
	const before = await db.selectFrom("monti_admin").selectAll().executeTakeFirstOrThrow();

	// AUTH-4.1
	await expect(monti.admin.update({ currentPassword: "wrong password", ...changed })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
	const after = await db.selectFrom("monti_admin").selectAll().executeTakeFirstOrThrow();
	// AUTH-4.2
	expect(after.email).toBe(owner.email);
	// AUTH-4.3
	expect(after.password_hash).toBe(before.password_hash);
});
