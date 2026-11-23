import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { docOf } from "../_shared/doc";
import { uuidInput } from "../_shared/input";
import { removeMediaUses, replaceMediaUses } from "../media/uses";

/** 템플릿 동작이 돌려주는 템플릿: 그 행. */
interface Template {
	id: string;
	collection: string;
	name: string;
	content: Doc;
}

const SHOWN = ["id", "collection", "name", "content"] as const;

const createInput = z.object({
	__preset_id: uuidInput.optional(),
	collection: z.string(),
	name: z.string().min(1),
	content: z.unknown(),
});

/**
 * 스키마 컬렉션의 템플릿을 만들고 본문이 참조하는 미디어를 색인한다. 같은 컬렉션의 템플릿과 이름이 겹치면 DB 고유 제약이
 * `CONFLICT`로 막는다.
 */
async function createTemplate(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Template> {
	if (!Object.hasOwn(ctx.schema.collections, input.collection)) {
		throw new MontiError("BAD_REQUEST", `"${input.collection}" 컬렉션이 없다`);
	}
	const doc = docOf(input.content, ctx);
	const template = { id: input.__preset_id ?? randomUUID(), collection: input.collection, name: input.name };
	await replaceMediaUses(ctx, { source_kind: "template", source_id: template.id }, "content", doc);
	return ctx.db
		.insertInto("templates")
		.values({ ...template, content: JSON.stringify(doc) })
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
}

const listInput = z.object({ collection: z.string().optional() });

/** The templates of every collection, or of one when `collection` is given. */
async function listTemplates(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<Template[]> {
	let query = ctx.db.selectFrom("templates").select(SHOWN);
	if (input.collection !== undefined) query = query.where("collection", "=", input.collection);
	return query.execute();
}

const idInput = z.object({ id: uuidInput });

function templateQuery(ctx: ReadContext, id: string) {
	return ctx.db.selectFrom("templates").select(SHOWN).where("id", "=", id);
}

/** 찾은 템플릿 행. 없으면 `NOT_FOUND`다. */
function found(row: Template | undefined): Template {
	if (row === undefined) throw new MontiError("NOT_FOUND", "이 `id`의 템플릿이 없다");
	return row;
}

async function getTemplate(input: z.infer<typeof idInput>, ctx: ReadContext): Promise<Template> {
	return found(await templateQuery(ctx, input.id).executeTakeFirst());
}

const updateInput = z.object({ id: uuidInput, name: z.string().min(1).optional(), content: z.unknown().optional() });

/**
 * 템플릿의 이름을 바꾸거나 본문을 교체한다. 새 본문은 `media_uses`를 갈아 끼우고, 기존 본문에 이미 있던 미디어는
 * 휴지통에 있어도 그대로 둘 수 있다. 본문을 생략하면 `media_uses`를 그대로 둔다. 템플릿 행을 잠그고 읽어, 겹친 수정은 이
 * 수정이 커밋된 뒤의 이름과 본문에서 이어 간다.
 */
async function updateTemplate(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<Template> {
	const existing = found(await templateQuery(ctx, input.id).forUpdate().executeTakeFirst());
	const doc = input.content === undefined ? undefined : docOf(input.content, ctx);
	const name = input.name ?? existing.name;
	const source = { source_kind: "template" as const, source_id: input.id };
	if (doc !== undefined) await replaceMediaUses(ctx, source, "content", doc, existing.content);
	return ctx.db
		.updateTable("templates")
		.set({ name, content: doc === undefined ? undefined : JSON.stringify(doc) })
		.where("id", "=", input.id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
}

/** Deletes a template and its `media_uses`. */
async function deleteTemplate(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<void> {
	const deleted = await ctx.db.deleteFrom("templates").where("id", "=", input.id).returning("id").executeTakeFirst();
	if (deleted === undefined) throw new MontiError("NOT_FOUND", "No template has this id");
	await removeMediaUses(ctx, { source_kind: "template", source_id: input.id });
}

/** The `templates` resource: reusable bodies of a collection's entries. */
export const templates = {
	list: defineRead({ input: listInput, run: listTemplates }),
	get: defineRead({ input: idInput, run: getTemplate }),
	create: defineWrite({ input: createInput, run: createTemplate }),
	update: defineWrite({ input: updateInput, run: updateTemplate }),
	delete: defineWrite({ input: idInput, run: deleteTemplate }),
};
