import { createHash, randomBytes } from "node:crypto";
import type { Transaction } from "kysely";
import type { Database } from "../../db/types";

/** 세션 수명: 30일(밀리초). */
const SESSION_LIFETIME_MS = 2_592_000_000;

/** 세션 행에는 토큰 원문이 아니라 이 해시를 저장한다. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** 관리자의 새 세션을 저장하고 그 토큰을 돌려준다. */
export async function issueSession(db: Transaction<Database>, adminId: string): Promise<string> {
	const token = randomBytes(32).toString("base64url");
	await db
		.insertInto("session")
		.values({
			token_hash: hashToken(token),
			admin_id: adminId,
			expires_at: new Date(Date.now() + SESSION_LIFETIME_MS),
		})
		.execute();
	return token;
}
