import { z } from "zod";
import { getCmsContentStore } from "../../../../../container";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler";

/** `title`: title of the copy (the admin UI sends the original title with a suffix such as "(Copy)"). If omitted, the original title is used as is. */
const duplicateSchema = z.object({ title: z.string().optional() }).strict();

/** Duplicates the latest draft as a draft with a new ID. */
export const POST = adminRoute<{ id: string }>(async ({ request, params }) => {
	const { title } = parseWith(duplicateSchema, await readJsonBody(request));
	return json(await getCmsContentStore().duplicateEntry({ id: params.id, title }), { status: 201 });
});
