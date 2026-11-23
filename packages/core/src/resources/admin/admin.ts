import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineWrite } from "../../engine/operation";
import type { WriteContext } from "../../engine/types";
import { issueSession } from "../session/issue";
import { hashPassword, verifyPassword } from "./password";

const emailInput = z.email();
const passwordInput = z.string().min(1);

const createInput = z.object({ email: emailInput, password: passwordInput });

/** 첫 관리자를 만들고 로그인시킨다. 관리자는 언제나 하나뿐이다. */
async function createAdmin(
	input: z.infer<typeof createInput>,
	ctx: WriteContext,
): Promise<{ id: string; email: string; token: string }> {
	const existing = await ctx.db.selectFrom("admin").select("id").executeTakeFirst();
	if (existing !== undefined) throw new MontiError("CONFLICT", "관리자가 이미 있습니다");
	const id = randomUUID();
	const passwordHash = await hashPassword(input.password);
	await ctx.db.insertInto("admin").values({ id, email: input.email, password_hash: passwordHash }).execute();
	const token = await issueSession(ctx.db, id);
	return { id, email: input.email, token };
}

const updateInput = z.object({ currentPassword: z.string(), email: emailInput, password: passwordInput });

/**
 * 현재 비밀번호를 확인한 뒤 관리자의 이메일과 비밀번호를 바꾸고, 모든 세션을 로그아웃시킨다. 관리자가 없으면 거절한다.
 * 관리자 행을 잠그고 읽어, 겹친 수정과 로그인은 이 수정이 커밋된 뒤의 비밀번호로 확인된다.
 */
async function updateAdmin(
	input: z.infer<typeof updateInput>,
	ctx: WriteContext,
): Promise<{ id: string; email: string }> {
	const current = await ctx.db.selectFrom("admin").select(["id", "password_hash"]).forUpdate().executeTakeFirst();
	if (current === undefined) throw new MontiError("UNAUTHORIZED", "관리자 계정이 없습니다");
	if (!(await verifyPassword(input.currentPassword, current.password_hash))) {
		throw new MontiError("UNAUTHORIZED", "현재 비밀번호가 틀렸습니다");
	}
	const passwordHash = await hashPassword(input.password);
	await ctx.db
		.updateTable("admin")
		.set({ email: input.email, password_hash: passwordHash })
		.where("id", "=", current.id)
		.execute();
	await ctx.db.deleteFrom("session").execute();
	return { id: current.id, email: input.email };
}

const create = defineWrite({ input: createInput, run: createAdmin });
const update = defineWrite({ input: updateInput, run: updateAdmin });

export const admin = { create, update };
