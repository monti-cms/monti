import { sql } from "kysely";
import { z } from "zod";
import { deliveryCounts } from "../engine/deliveries";
import { CheckError } from "../errors";
import { defineOperation, type OperationContext } from "../operation";
import { siteFace } from "../settings/values";
import { trashRowCount } from "../trash/list";
import { DEV_WHO, hostedBy } from "./dev-bypass";
import { MIN_PASSWORD } from "./reset";
import { hashPassword, verifyPassword } from "./secrets";
import { endSession, startSession } from "./session";

/** The ways to sign in that `monti init` chose (doc 15, principle 2). Neither: "sign-in is not set up". */
export type AuthSettings = {
	password: boolean;
	/** The GitHub way: the OAuth app and the one account that is the admin. */
	github: { clientId: string; clientSecret: string; admin: string } | null;
	/**
	 * On the dev server, a request from this machine is let in without signing in (doc 16); `false` turns it off, to try the sign-in screens
	 * locally. The live site never bypasses, whatever this says.
	 */
	devBypass: boolean;
};

/** Wrong passwords per email before the minute's lock (doc 15). */
export const SIGN_IN_TRIES = 5;
const LOCK_MS = 60_000;

const normal = (email: string) => email.trim().toLowerCase();

/** The dev server (it can write the schema file) with the bypass left on and a way to prove a browser is on this machine. */
const devBypassOn = (ctx: OperationContext) =>
	ctx.site.files !== null && ctx.site.auth.devBypass && ctx.site.devProof !== null && hostedBy() === undefined;

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
		description:
			"The ways to sign in (a password, and sign-ins at another site such as GitHub, each with the admin API path that starts it), whether there is an admin yet, who is signed in (`bypass` when the dev server let this machine in without signing in), and what the admin draws with before any screen opens: the site's name and the admin's language as saved in the settings, and whether body templates are offered.",
		input: z.object({}),
		async run(_input, ctx) {
			return {
				methods: {
					password: ctx.site.auth.password,
					// The screens draw one button per sign-in at another site and know none of them by name, so another (or a plugin's) is one more row here.
					external: ctx.site.auth.github ? [{ id: "github", label: "GitHub", path: "auth/github" }] : [],
				},
				hasAdmin: await hasAdmin(ctx),
				// `bypass`: nobody signed in; the dev server let this machine in (doc 16). The screen says so.
				session: ctx.session
					? { who: ctx.session.who, ...(ctx.session.who === DEV_WHO ? { bypass: true } : {}) }
					: null,
				// Where a browser on this machine gets the ticket that lets it in without signing in (`auth.devSignIn`). The admin API leaves it out for a
				// request that does not claim to be local.
				...(ctx.session || !devBypassOn(ctx) ? {} : { devProof: ctx.site.devProof?.url() ?? undefined }),
				// The sign-in screen is drawn before there is a session, so the name and the language come with this answer (doc 12, T36).
				site: await siteFace(ctx.db),
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
		// Who signs in and out is no change to the site: the rows are written and the log does not list them.
		log: false,
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
		log: false,
		summary: (_input, output) => ({ key: output.ok ? "auth.signedIn" : "auth.signInRefused" }),
	}),
	defineOperation({
		name: "auth.devSignIn",
		kind: "write",
		humanOnly: true,
		open: true,
		description:
			"On the dev server, let a browser of this machine in without signing in: it hands in the one-time ticket it fetched from the loopback address `auth.state` names.",
		input: z.object({ ticket: z.string().min(1).max(200) }),
		async run(input, ctx): Promise<SignedIn | Refused> {
			// The ticket is used up by the asking, good or not.
			if (!devBypassOn(ctx) || !ctx.site.devProof?.take(input.ticket))
				return { ok: false, reason: { key: "auth.devRefused" } };
			return { ok: true, who: DEV_WHO, ...(await startSession(ctx.db, DEV_WHO, ctx.now())) };
		},
		log: false,
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
		log: false,
		summary: () => ({ key: "auth.signedOut" }),
	}),
	defineOperation({
		name: "frame.counts",
		kind: "read",
		description:
			"How many entries each collection has (translation groups not in the trash), how many rows the trash shows (entries, folders and media files), and how many deliveries failed.",
		input: z.object({}),
		async run(_input, ctx) {
			const groups = await ctx.db
				.selectFrom("entries")
				.select(["collection", sql<string>`count(distinct translation_group)`.as("count")])
				.where("trashed_at", "is", null)
				.groupBy("collection")
				.execute();
			return {
				collections: Object.fromEntries(
					Object.keys(ctx.site.schema().collections).map((name) => [
						name,
						Number(groups.find((row) => row.collection === name)?.count ?? 0),
					]),
				),
				trash: await trashRowCount(ctx.db, ctx.site.schema().locales.source),
				// The one count the activity tab and its banner show too (13-4).
				failedDeliveries: (await deliveryCounts(ctx.db, ctx.now())).failed,
			};
		},
	}),
];
