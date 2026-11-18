import { createHash, randomBytes } from "node:crypto";
import type { Transaction } from "kysely";
import type { Database } from "../../db/types";

/** How long a session lasts: 30 days, in milliseconds. */
const SESSION_LIFETIME_MS = 2_592_000_000;

/** The session row keeps this hash, never the token itself. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** Stores a new session of the admin and returns its token. */
export async function issueSession(db: Transaction<Database>, adminId: string): Promise<string> {
	const token = randomBytes(32).toString("base64url");
	await db
		.insertInto("monti_session")
		.values({
			token_hash: hashToken(token),
			admin_id: adminId,
			expires_at: new Date(Date.now() + SESSION_LIFETIME_MS),
		})
		.execute();
	return token;
}
