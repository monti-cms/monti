import type { Kysely, Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { randomToken, sha256 } from "./secrets";

type Db = Kysely<Database> | Transaction<Database>;

/** A session ends after 30 days without use; using it moves the end (doc 15). */
export const SESSION_DAYS = 30;
const DAY = 86_400_000;

export type Session = { id: string; who: string };

/** Starts a session; the token goes in the cookie and is never stored. */
export async function startSession(db: Db, who: string, now: Date): Promise<{ token: string; expiresAt: Date }> {
	const token = randomToken();
	const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
	await db
		.insertInto("monti_session")
		.values({ id: randomUUID(), token_hash: await sha256(token), who, expires_at: expiresAt })
		.execute();
	return { token, expiresAt };
}

/** The session a cookie's token opens, moving its end when it was last moved more than a day ago. */
export async function findSession(db: Db, token: string | null | undefined, now: Date): Promise<Session | null> {
	if (!token) return null;
	const row = await db
		.selectFrom("monti_session")
		.select(["id", "who", "expires_at"])
		.where("token_hash", "=", await sha256(token))
		.executeTakeFirst();
	if (!row || row.expires_at <= now) return null;
	const end = new Date(now.getTime() + SESSION_DAYS * DAY);
	if (end.getTime() - row.expires_at.getTime() > DAY)
		await db.updateTable("monti_session").set({ expires_at: end }).where("id", "=", row.id).execute();
	return { id: row.id, who: row.who };
}

export async function endSession(db: Db, id: string): Promise<void> {
	await db.deleteFrom("monti_session").where("id", "=", id).execute();
}

/** Ends every session: after a password reset, a browser that knew the old one is signed out. */
export async function endAllSessions(db: Db): Promise<void> {
	await db.deleteFrom("monti_session").execute();
}
