import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineWrite } from "../../engine/operation";
import type { WriteContext } from "../../engine/types";
import { issueSession } from "../session/issue";
import { hashPassword, verifyPassword } from "./password";

const createInput = z.object({ email: z.string(), password: z.string() });

/** Creates the first admin and signs it in; there is only ever one admin. */
async function createAdmin(
	input: z.infer<typeof createInput>,
	ctx: WriteContext,
): Promise<{ id: string; email: string; token: string }> {
	const existing = await ctx.db.selectFrom("monti_admin").select("id").executeTakeFirst();
	if (existing !== undefined) throw new MontiError("CONFLICT", "An admin already exists");
	const id = randomUUID();
	const passwordHash = await hashPassword(input.password);
	await ctx.db.insertInto("monti_admin").values({ id, email: input.email, password_hash: passwordHash }).execute();
	const token = await issueSession(ctx.db, id);
	return { id, email: input.email, token };
}

const updateInput = z.object({ currentPassword: z.string(), email: z.string(), password: z.string() });

/** Changes the admin's email and password after checking the current one, and signs every session out. */
async function updateAdmin(
	input: z.infer<typeof updateInput>,
	ctx: WriteContext,
): Promise<{ id: string; email: string }> {
	const current = await ctx.db.selectFrom("monti_admin").select(["id", "password_hash"]).executeTakeFirstOrThrow();
	if (!(await verifyPassword(input.currentPassword, current.password_hash))) {
		throw new MontiError("UNAUTHORIZED", "Wrong current password");
	}
	const passwordHash = await hashPassword(input.password);
	await ctx.db
		.updateTable("monti_admin")
		.set({ email: input.email, password_hash: passwordHash })
		.where("id", "=", current.id)
		.execute();
	await ctx.db.deleteFrom("monti_session").execute();
	return { id: current.id, email: input.email };
}

const create = defineWrite({ input: createInput, run: createAdmin });
const update = defineWrite({ input: updateInput, run: updateAdmin });

export const admin = { create, update };
