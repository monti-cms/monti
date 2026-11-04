import { sql } from "kysely";
import { z } from "zod";
import { CheckError } from "../errors";
import { defineOperation, type OperationContext } from "../operation";
import { MIN_PASSWORD } from "./reset";
import { hashPassword, verifyPassword } from "./secrets";
import { endSession, startSession } from "./session";

/** The ways to sign in that `monti init` chose (doc 15, principle 2). Neither: "sign-in is not set up". */
export type AuthSettings = {
	password: boolean;
	/** The GitHub way: the OAuth app and the one account that is the admin. */
	github: { clientId: string; clientSecret: string; admin: string } | null;
};

/** Wrong passwords per email before the minute's lock (doc 15). */
export const SIGN_IN_TRIES = 5;
const LOCK_MS = 60_000;

const normal = (email: string) => email.trim().toLowerCase();

async function hasAdmin(ctx: OperationContext) {
	if (ctx.site.auth.github && !ctx.site.auth.password) return true;
	return (await ctx.db.selectFrom("monti_admin").select("id").executeTakeFirst()) !== undefined;
}

type SignedIn = { ok: true; who: string; token: string; expiresAt: Date };
type Refused = { ok: false; reason: { key: string } };

export const authOperations = [
	defineOperation({
		name: "auth.state",
		kind: "read",
		open: true,
		description: "The ways to sign in, whether there is an admin yet, and who is signed in.",
		input: z.object({}),
		async run(_input, ctx) {
			return {
				methods: { password: ctx.site.auth.password, github: ctx.site.auth.github !== null },
				hasAdmin: await hasAdmin(ctx),
				session: ctx.session ? { who: ctx.session.who } : null,
			};
		},
	}),
	defineOperation({
		name: "auth.createFirstAdmin",
		kind: "write",
		humanOnly: true,
		open: true,
		description: "Make the first admin when there is none, and sign in as them.",
		input: z.object({ email: z.string().email(), password: z.string(), confirm: z.string() }),
		async check(input, ctx) {
			if (!ctx.site.auth.password) throw new CheckError({ key: "auth.methodOff" });
			if (await hasAdmin(ctx)) throw new CheckError({ key: "auth.adminExists" });
			if (input.password.length < MIN_PASSWORD)
				throw new CheckError({ key: "auth.passwordShort", values: { min: MIN_PASSWORD } });
			if (input.password !== input.confirm) throw new CheckError({ key: "auth.passwordsDiffer" });
		},
		async run(input, ctx): Promise<SignedIn> {
			const email = normal(input.email);
			// One row only (id = 1): a second first admin made at the same moment fails here and is told the admin exists.
			const made = await ctx.db
				.insertInto("monti_admin")
				.values({ id: 1, email, password_hash: await hashPassword(input.password) })
				.onConflict((conflict) => conflict.column("id").doNothing())
				.returning("id")
				.executeTakeFirst();
			if (!made) throw new CheckError({ key: "auth.adminExists" });
			return { ok: true, who: email, ...(await startSession(ctx.db, email, ctx.now())) };
		},
		summary: () => ({ key: "auth.createFirstAdmin" }),
	}),
	defineOperation({
		name: "auth.signIn",
		kind: "write",
		humanOnly: true,
		open: true,
		description: "Sign in with email and password. After five wrong tries for an email it waits a minute.",
		input: z.object({ email: z.string(), password: z.string() }),
		check(_input, ctx) {
			if (!ctx.site.auth.password) throw new CheckError({ key: "auth.methodOff" });
		},
		// A wrong password is an answer, not a failure: the write commits, so the try is counted.
		async run(input, ctx): Promise<SignedIn | Refused> {
			const email = normal(input.email);
			const now = ctx.now();
			const since = new Date(now.getTime() - LOCK_MS);
			const tries = await ctx.db
				.selectFrom("monti_sign_in_attempt")
				.select((eb) => eb.fn.countAll<string>().as("count"))
				.where("email", "=", email)
				.where("at", ">", since)
				.executeTakeFirstOrThrow();
			if (Number(tries.count) >= SIGN_IN_TRIES) return { ok: false, reason: { key: "auth.locked" } };
			const admin = await ctx.db.selectFrom("monti_admin").selectAll().executeTakeFirst();
			if (!admin || admin.email !== email || !(await verifyPassword(input.password, admin.password_hash))) {
				await ctx.db.insertInto("monti_sign_in_attempt").values({ email, at: now }).execute();
				return { ok: false, reason: { key: "auth.wrong" } };
			}
			await ctx.db.deleteFrom("monti_sign_in_attempt").where("email", "=", email).execute();
			return { ok: true, who: email, ...(await startSession(ctx.db, email, now)) };
		},
		summary: (_input, output) => ({ key: output.ok ? "auth.signedIn" : "auth.signInRefused" }),
	}),
	defineOperation({
		name: "auth.signOut",
		kind: "write",
		humanOnly: true,
		description: "Sign out of this browser.",
		input: z.object({}),
		async run(_input, ctx) {
			if (ctx.session) await endSession(ctx.db, ctx.session.id);
			return { ok: true };
		},
		summary: () => ({ key: "auth.signedOut" }),
	}),
	defineOperation({
		name: "frame.counts",
		kind: "read",
		description:
			"How many entries each collection has (translation groups not in the trash), how many rows the trash has, and how many deliveries failed.",
		input: z.object({}),
		async run(_input, ctx) {
			const groups = await ctx.db
				.selectFrom("entries")
				.select(["collection", sql<string>`count(distinct translation_group)`.as("count")])
				.where("trashed_at", "is", null)
				.groupBy("collection")
				.execute();
			const trash = await ctx.db
				.selectFrom("entries")
				.select(sql<string>`count(distinct translation_group)`.as("count"))
				.where("trashed_at", "is not", null)
				.executeTakeFirstOrThrow();
			const failed = await ctx.db
				.selectFrom("monti_delivery")
				.select((eb) => eb.fn.countAll<string>().as("count"))
				.where("state", "=", "failed")
				.executeTakeFirstOrThrow();
			return {
				collections: Object.fromEntries(
					Object.keys(ctx.site.schema().collections).map((name) => [
						name,
						Number(groups.find((row) => row.collection === name)?.count ?? 0),
					]),
				),
				trash: Number(trash.count),
				failedDeliveries: Number(failed.count),
			};
		},
	}),
];
