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
	await migrate(testDb.db, "@monti-cms/core", [initial]);
	db = testDb.db as Kysely<Database>;
	monti = montiOf(db);
	adminId = (await monti.admin.create(owner)).id;
});

afterEach(async () => {
	await testDb.drop();
});

async function sessionRows() {
	return db.selectFrom("session").selectAll().execute();
}

it("SES-CRT-1 이메일과 비밀번호가 맞으면 세션을 발급한다", async () => {
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

it("SES-CRT-2 비밀번호가 틀리면 로그인할 수 없다", async () => {
	// SES-CRT-2.1
	await expect(monti.session.create({ email: owner.email, password: "wrong password" })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("SES-CRT-3 등록되지 않은 이메일로는 로그인할 수 없다", async () => {
	// SES-CRT-3.1
	await expect(monti.session.create({ email: "nobody@example.com", password: owner.password })).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

it("SES-GET-1 유효한 토큰이면 관리자를 돌려준다", async () => {
	const { token } = await monti.session.create(owner);

	// SES-GET-1.1
	expect(await monti.session.get({ token })).toEqual({ admin: { id: adminId, email: owner.email } });
});

it("SES-GET-2 만료된 토큰이면 빈 결과를 돌려준다", async () => {
	const expired = await monti.session.create(owner);
	await db
		.updateTable("session")
		.set({ expires_at: new Date(Date.now() - 1000) })
		.where("token_hash", "=", hashToken(expired.token))
		.execute();

	// SES-GET-2.1
	expect(await monti.session.get({ token: expired.token })).toEqual({ admin: null });
});

it("SES-GET-3 존재하지 않는 토큰이면 빈 결과를 돌려준다", async () => {
	// SES-GET-3.1
	expect(await monti.session.get({ token: "no-such-token" })).toEqual({ admin: null });
});

it("SES-DEL-1 해당 토큰의 세션만 지운다", async () => {
	const first = await monti.session.create(owner);
	const second = await monti.session.create(owner);

	await monti.session.delete({ token: first.token });

	// SES-DEL-1.1
	expect(await monti.session.get({ token: first.token })).toEqual({ admin: null });
	// SES-DEL-1.2
	expect(await monti.session.get({ token: second.token })).toEqual({ admin: { id: adminId, email: owner.email } });
});
