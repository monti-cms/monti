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

/** Rejects a name another template of the same collection already has; `id` is the template itself, left out. */
async function rejectTaken(ctx: WriteContext, template: Omit<Template, "content">): Promise<void> {
	const taken = await ctx.db
		.selectFrom("templates")
		.select("id")
		.where("id", "<>", template.id)
		.where("collection", "=", template.collection)
		.where("name", "=", template.name)
		.executeTakeFirst();
	if (taken !== undefined) throw new MontiError("CONFLICT", "A template of this collection already has this name");
}

const createInput = z.object({
	__preset_id: uuidInput.optional(),
	collection: z.string(),
	name: z.string().min(1),
	content: z.unknown(),
});

/** Makes a template of a schema collection and indexes the media its body references. */
async function createTemplate(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Template> {
	if (!Object.hasOwn(ctx.schema.collections, input.collection)) {
		throw new MontiError("BAD_REQUEST", `No collection is named "${input.collection}"`);
	}
	const doc = docOf(input.content, ctx);
	const template = { id: input.__preset_id ?? randomUUID(), collection: input.collection, name: input.name };
	await rejectTaken(ctx, template);
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

async function getTemplate(input: z.infer<typeof idInput>, ctx: ReadContext): Promise<Template> {
	const row = await ctx.db.selectFrom("templates").select(SHOWN).where("id", "=", input.id).executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "No template has this id");
	return row;
}

const updateInput = z.object({ id: uuidInput, name: z.string().min(1).optional(), content: z.unknown().optional() });

/**
 * 템플릿의 이름을 바꾸거나 본문을 교체한다. 새 본문은 `media_uses`를 갈아 끼우고, 기존 본문에 이미 있던 미디어는
 * 휴지통에 있어도 그대로 둘 수 있다. 본문을 생략하면 `media_uses`를 그대로 둔다.
 */
async function updateTemplate(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<Template> {
	const existing = await getTemplate(input, ctx);
	const doc = input.content === undefined ? undefined : docOf(input.content, ctx);
	const name = input.name ?? existing.name;
	await rejectTaken(ctx, { ...existing, name });
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
	create: defineWrite({ emit: true, input: createInput, run: createTemplate }),
	update: defineWrite({ emit: true, input: updateInput, run: updateTemplate }),
	delete: defineWrite({ emit: true, input: idInput, run: deleteTemplate }),
};
