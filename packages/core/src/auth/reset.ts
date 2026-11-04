import type { Kysely } from "kysely";
import type { Database } from "../db/schema";
import { hashPassword } from "./secrets";
import { endAllSessions } from "./session";

export const MIN_PASSWORD = 10;

/**
 * `monti admin:reset-password`: the way back for a forgotten password, run on the server (doc 15, principle 4). It sets the admin's password (making
 * the admin with `email` if there is none), lifts the lock and signs every browser out.
 */
export async function resetAdminPassword(db: Kysely<Database>, password: string, email?: string): Promise<string> {
	if (password.length < MIN_PASSWORD) throw new Error(`The password needs at least ${MIN_PASSWORD} characters.`);
	return db.transaction().execute(async (trx) => {
		const admin = await trx.selectFrom("monti_admin").select("email").executeTakeFirst();
		const address = email?.trim().toLowerCase() ?? admin?.email;
		if (!address) throw new Error("There is no admin yet: give --email to make one.");
		const hash = await hashPassword(password);
		await trx
			.insertInto("monti_admin")
			.values({ id: 1, email: address, password_hash: hash })
			.onConflict((conflict) => conflict.column("id").doUpdateSet({ email: address, password_hash: hash }))
			.execute();
		await trx.deleteFrom("monti_sign_in_attempt").execute();
		await endAllSessions(trx);
		return address;
	});
}
