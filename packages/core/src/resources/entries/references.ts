import { sql } from "kysely";
import { z } from "zod";
import { lockFolderScope } from "../../db/locks";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { isMany, type Slot, slotsOf } from "./slots";
import { type Row, tablesOf } from "./tables";

export const replaceInput = z.object({ from_id: uuidInput, into_id: uuidInput });

/** 바꿀 참조: 컬렉션 `to`를 가리키는 관계 가운데 `from`을 가리키던 것이 `into`를 가리키게 된다. */
interface Swap {
	to: string;
	from: string;
	into: string;
}

/**
 * `from_id`와 `into_id`가 속한 컬렉션. 없는 글이나 휴지통에 있는 `into_id`는 거절하고(휴지통의 `from_id`는 받는다),
 * 같은 글이나 서로 다른 컬렉션의 글도 거절한다.
 */
async function collectionOfBoth(ctx: WriteContext, input: z.infer<typeof replaceInput>): Promise<string> {
	const found = new Map<string, { name: string; trashed: boolean }>();
	for (const name of Object.keys(ctx.schema.collections)) {
		const rows = await tablesOf(ctx.db)
			.selectFrom(name)
			.select(["id", "trashed_at"])
			.where("id", "in", [input.from_id, input.into_id])
			.execute();
		for (const row of rows) found.set(String(row.id), { name, trashed: row.trashed_at !== null });
	}
	const from = found.get(input.from_id);
	const into = found.get(input.into_id);
	if (from === undefined || into === undefined || into.trashed) {
		throw new MontiError("NOT_FOUND", "`from_id`와 `into_id`는 글이어야 하고 `into_id`는 활성 글이어야 한다");
	}
	if (input.from_id === input.into_id || from.name !== into.name) {
		throw new MontiError("BAD_REQUEST", "`from_id`와 `into_id`는 한 컬렉션의 서로 다른 두 글이어야 한다");
	}
	return from.name;
}

/** `from`을 `into`로 바꾼 목록. `into`는 처음 나온 자리에 하나만 남긴다. */
function swapIds(ids: unknown[], swap: Swap): unknown[] {
	const swapped = ids.map((id) => (id === swap.from ? swap.into : id));
	return swapped.filter((id, index) => id !== swap.into || swapped.indexOf(id) === index);
}

/** 단건 관계 열 `column`에서 바꾸고, 바뀐 글의 `id`들을 돌려준다. */
async function swapColumn(ctx: WriteContext, name: string, column: string, swap: Swap): Promise<string[]> {
	const rows = await tablesOf(ctx.db)
		.updateTable(`${name}_data`)
		.set({ [column]: swap.into })
		.where(column, "=", swap.from)
		.returning("entry_id")
		.execute();
	return rows.map((row) => String(row.entry_id));
}

/**
 * 다건 관계 `path`에서 `swap.from`을 가리키는 언어·상태 묶음들. 그 묶음들의 목록을 잠그기 전에 한 번에 읽어 바꿀 묶음을
 * 고른다.
 */
async function referringGroups(ctx: WriteContext, name: string, path: string, swap: Swap): Promise<Row[]> {
	const db = tablesOf(ctx.db);
	const column = `${swap.to}_id`;
	const referring = db
		.selectFrom(`${name}_rels`)
		.select(["entry_id", "locale", "status"])
		.where("path", "=", path)
		.where(column, "=", swap.from);
	const rows = await db
		.selectFrom(`${name}_rels`)
		.select(["entry_id", "locale", "status", column])
		.where("path", "=", path)
		.where(sql<boolean>`(entry_id, locale, status) in (${referring})`)
		.orderBy("position")
		.execute();
	const groups = rows.map(({ entry_id, locale, status }) => ({ entry_id, locale, status }));
	return groups.filter((group, index) => groups.findIndex((other) => sameGroup(other, group)) === index);
}

function sameGroup(a: Row, b: Row): boolean {
	return a.entry_id === b.entry_id && a.locale === b.locale && a.status === b.status;
}

/**
 * 한 언어·상태(`group`)의 다건 관계 `path` 행들을 바꾼 목록으로 다시 쓴다. 지우면서 돌려받은 지금 목록을 바꾸므로, 잠그기
 * 전에 다른 수정이 커밋한 항목도 남는다. `position`은 0부터 다시 매긴다.
 */
async function rewriteGroup(ctx: WriteContext, name: string, group: Row, path: string, swap: Swap): Promise<void> {
	const db = tablesOf(ctx.db);
	const column = `${swap.to}_id`;
	const current = await db
		.deleteFrom(`${name}_rels`)
		.where("entry_id", "=", group.entry_id)
		.where("locale", "=", group.locale)
		.where("status", "=", group.status)
		.where("path", "=", path)
		.returning([column, "position"])
		.execute();
	const ids = current.sort((a, b) => Number(a.position) - Number(b.position)).map((row) => row[column]);
	const rows = swapIds(ids, swap).map((id, position) => ({ ...group, path, position, [column]: id }));
	// 빈 `values`는 SQL이 아니다: 그사이 목록이 비었으면 넣을 행도 없다.
	if (rows.length > 0) await db.insertInto(`${name}_rels`).values(rows).execute();
}

/** 바꿀 관계 하나: 컬렉션 `name`의 관계 자리와, 다건이면 잠그기 전에 고른 바꿀 묶음들. */
interface Change {
	name: string;
	slot: Slot;
	groups: Row[];
}

/** `swap.to`를 가리키는 모든 관계 자리(조건부 하위, 여러 개 선택 포함)와 다건 자리의 바꿀 묶음들. 잠그지 않고 읽는다. */
async function changesOf(ctx: WriteContext, swap: Swap): Promise<Change[]> {
	const changes: Change[] = [];
	for (const [name, collection] of Object.entries(ctx.schema.collections)) {
		for (const slot of slotsOf(collection)) {
			if (slot.field.type !== "relation" || slot.field.to !== swap.to) continue;
			const groups = isMany(slot.field) ? await referringGroups(ctx, name, slot.path, swap) : [];
			changes.push({ name, slot, groups });
		}
	}
	return changes;
}

/** 관계 하나를 바꾸고 바뀐 글의 `id`들을 돌려준다. */
async function applyChange(ctx: WriteContext, change: Change, swap: Swap): Promise<string[]> {
	if (!isMany(change.slot.field)) return swapColumn(ctx, change.name, change.slot.column, swap);
	for (const group of change.groups) await rewriteGroup(ctx, change.name, group, change.slot.path, swap);
	return change.groups.map((group) => String(group.entry_id));
}

/**
 * `from_id`를 가리키던 모든 관계(조건부 하위, 여러 개 선택 포함)가 `into_id`를 가리키게 한다. 모든 언어의 작업본과
 * 발행본, 휴지통 글까지 고치고 `from_id`는 그대로 둔다. `updated_ids`에는 바뀐 글이 한 번씩 든다. 바꿀 묶음을 고른 뒤
 * 관계가 있는 컬렉션들의 `scope` 잠금을 이름 순으로 잡고 바꿔, 진행 중인 글 수정이 끝난 뒤의 목록을 고친다.
 */
export async function replaceReferences(input: z.infer<typeof replaceInput>, ctx: WriteContext) {
	const swap = { to: await collectionOfBoth(ctx, input), from: input.from_id, into: input.into_id };
	const changes = await changesOf(ctx, swap);
	for (const name of [...new Set(changes.map((change) => change.name))].sort()) await lockFolderScope(ctx.db, name);
	const updated = new Set<string>();
	for (const change of changes) for (const id of await applyChange(ctx, change, swap)) updated.add(id);
	return { from_id: input.from_id, into_id: input.into_id, updated_ids: [...updated] };
}
