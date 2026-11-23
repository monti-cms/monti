import { lockFolderScope } from "../../db/locks";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { findEntry } from "./read";
import { tablesOf } from "./tables";
import type { Entry, Status } from "./types";

/**
 * 컬렉션 `name`의 글 `id`를 쓰기 전에 잡는 잠금: 그 컬렉션의 `scope` 잠금을 잡은 뒤 글 행을 이 트랜잭션이 끝날 때까지
 * 잠근다. 휴지통 이동·폴더 수정과 같은 순서로 잡아 서로 기다리다 멈추지 않는다. 없거나 휴지통에 있는 글이면 거절한다.
 */
export async function lockEntry(ctx: WriteContext, name: string, id: string): Promise<void> {
	await lockFolderScope(ctx.db, name);
	const row = await tablesOf(ctx.db)
		.selectFrom(name)
		.select("id")
		.where("id", "=", id)
		.where("trashed_at", "is", null)
		.forUpdate()
		.executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "글을 찾을 수 없다");
}

/**
 * 쓸 글의 `status` 행. 잠금 없이 찾아 그 글이 든 컬렉션을 알아낸 뒤 글을 잠그고 다시 찾는다: 그사이 커밋된 휴지통 이동·언어
 * 삭제·원문 언어 변경·다른 수정을 보고 판정한다.
 */
export async function findLockedEntry(
	ctx: WriteContext,
	key: { id: string; locale?: string },
	status: Status,
): Promise<Entry> {
	const found = await findEntry(ctx, key, status);
	await lockEntry(ctx, found.collection, found.id);
	return findEntry(ctx, key, status);
}
