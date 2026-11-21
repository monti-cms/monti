import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
import { verifyPassword } from "../admin/password";
import { hashToken, issueSession } from "./issue";

const tokenInput = z.object({ token: z.string() });

/** 유효한 세션의 관리자. 만료된 세션은 관리자 없음으로 읽는다. */
async function getSession(
	input: z.infer<typeof tokenInput>,
	ctx: ReadContext,
): Promise<{ admin: { id: string; email: string } | null }> {
	const admin = await ctx.db
		.selectFrom("session")
		.innerJoin("admin", "admin.id", "session.admin_id")
		.select(["admin.id", "admin.email"])
		.where("session.token_hash", "=", hashToken(input.token))
		.where("session.expires_at", ">", new Date())
		.executeTakeFirst();
	return { admin: admin ?? null };
}

const signInInput = z.object({ email: z.string(), password: z.string() });

/** 관리자를 로그인시킨다. 이메일이 틀려도 비밀번호가 틀려도 같은 `UNAUTHORIZED`를 던진다. */
async function createSession(input: z.infer<typeof signInInput>, ctx: WriteContext): Promise<{ token: string }> {
	const found = await ctx.db
		.selectFrom("admin")
		.select(["id", "password_hash"])
		.where("email", "=", input.email)
		.executeTakeFirst();
	if (found === undefined || !(await verifyPassword(input.password, found.password_hash))) {
		throw new MontiError("UNAUTHORIZED", "이메일 또는 비밀번호가 틀렸습니다");
	}
	return { token: await issueSession(ctx.db, found.id) };
}

async function deleteSession(input: z.infer<typeof tokenInput>, ctx: WriteContext): Promise<void> {
	await ctx.db.deleteFrom("session").where("token_hash", "=", hashToken(input.token)).execute();
}

const get = defineRead({ input: tokenInput, run: getSession });
const create = defineWrite({ input: signInInput, run: createSession });
const remove = defineWrite({ input: tokenInput, run: deleteSession });

export const session = { get, create, delete: remove };
