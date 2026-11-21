import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { isMany, slotsOf } from "./slots";
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

/** 한 언어·상태(`group`)의 다건 관계 `path` 행들을 바꾼 목록으로 다시 쓴다. `position`은 0부터 다시 매긴다. */
async function rewriteGroup(ctx: WriteContext, name: string, group: Row, path: string, swap: Swap): Promise<void> {
	const db = tablesOf(ctx.db);
	const column = `${swap.to}_id`;
	const current = db
		.selectFrom(`${name}_rels`)
		.where("entry_id", "=", group.entry_id)
		.where("locale", "=", group.locale)
		.where("status", "=", group.status)
		.where("path", "=", path);
	const ids = (await current.select(column).orderBy("position").execute()).map((row) => row[column]);
	await db
		.deleteFrom(`${name}_rels`)
		.where("entry_id", "=", group.entry_id)
		.where("locale", "=", group.locale)
		.where("status", "=", group.status)
		.where("path", "=", path)
		.execute();
	const rows = swapIds(ids, swap).map((id, position) => ({ ...group, path, position, [column]: id }));
	await db.insertInto(`${name}_rels`).values(rows).execute();
}

/** 다건 관계 `path`에서 바꾸고, 바뀐 글의 `id`들을 돌려준다. */
async function swapRels(ctx: WriteContext, name: string, path: string, swap: Swap): Promise<string[]> {
	const groups = await tablesOf(ctx.db)
		.selectFrom(`${name}_rels`)
		.select(["entry_id", "locale", "status"])
		.distinct()
		.where("path", "=", path)
		.where(`${swap.to}_id`, "=", swap.from)
		.execute();
	for (const group of groups) await rewriteGroup(ctx, name, group, path, swap);
	return groups.map((group) => String(group.entry_id));
}

/**
 * `from_id`를 가리키던 모든 관계(조건부 하위, 여러 개 선택 포함)가 `into_id`를 가리키게 한다. 모든 언어의 작업본과
 * 발행본, 휴지통 글까지 고치고 `from_id`는 그대로 둔다. `updated_ids`에는 바뀐 글이 한 번씩 든다.
 */
export async function replaceReferences(input: z.infer<typeof replaceInput>, ctx: WriteContext) {
	const swap = { to: await collectionOfBoth(ctx, input), from: input.from_id, into: input.into_id };
	const updated = new Set<string>();
	for (const [name, collection] of Object.entries(ctx.schema.collections)) {
		for (const slot of slotsOf(collection)) {
			if (slot.field.type !== "relation" || slot.field.to !== swap.to) continue;
			const ids = isMany(slot.field)
				? await swapRels(ctx, name, slot.path, swap)
				: await swapColumn(ctx, name, slot.column, swap);
			for (const id of ids) updated.add(id);
		}
	}
	return { from_id: input.from_id, into_id: input.into_id, updated_ids: [...updated] };
}
