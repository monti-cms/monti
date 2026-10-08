import { z } from "zod";
import { adminRoute, json, parseWith, readJsonBody } from "../../../handler.js";
/** `title`: title of the copy (the admin UI sends the original title with a suffix such as "(Copy)"). If omitted, the original title is used as is. */
const duplicateSchema = z.object({ title: z.string().optional() }).strict();
/** Duplicates the latest draft as a draft with a new ID, through the write pipeline. */
export const POST = adminRoute(async ({ request, params, cms }) => {
    const { title } = parseWith(duplicateSchema, await readJsonBody(request));
    return json(await cms.contentService().duplicate({ id: params.id, title }), { status: 201 });
});
