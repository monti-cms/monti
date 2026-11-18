import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
import { verifyPassword } from "../admin/password";
import { hashToken, issueSession } from "./issue";

const tokenInput = z.object({ token: z.string() });

/** The admin of a live session; an expired session reads as no admin. */
async function getSession(
	input: z.infer<typeof tokenInput>,
	ctx: ReadContext,
): Promise<{ admin: { id: string; email: string } | null }> {
	const admin = await ctx.db
		.selectFrom("monti_session")
		.innerJoin("monti_admin", "monti_admin.id", "monti_session.admin_id")
		.select(["monti_admin.id", "monti_admin.email"])
		.where("monti_session.token_hash", "=", hashToken(input.token))
		.where("monti_session.expires_at", ">", new Date())
		.executeTakeFirst();
	return { admin: admin ?? null };
}

const signInInput = z.object({ email: z.string(), password: z.string() });

/** Signs the admin in: a wrong email or password gets the same `UNAUTHORIZED`. */
async function createSession(input: z.infer<typeof signInInput>, ctx: WriteContext): Promise<{ token: string }> {
	const found = await ctx.db
		.selectFrom("monti_admin")
		.select(["id", "password_hash"])
		.where("email", "=", input.email)
		.executeTakeFirst();
	if (found === undefined || !(await verifyPassword(input.password, found.password_hash))) {
		throw new MontiError("UNAUTHORIZED", "Wrong email or password");
	}
	return { token: await issueSession(ctx.db, found.id) };
}

async function deleteSession(input: z.infer<typeof tokenInput>, ctx: WriteContext): Promise<void> {
	await ctx.db.deleteFrom("monti_session").where("token_hash", "=", hashToken(input.token)).execute();
}

const get = defineRead({ input: tokenInput, run: getSession });
const create = defineWrite({ input: signInInput, run: createSession });
const remove = defineWrite({ input: tokenInput, run: deleteSession });

export const session = { get, create, delete: remove };
