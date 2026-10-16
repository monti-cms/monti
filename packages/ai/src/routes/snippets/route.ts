import { adminRoute, CmsError, ok, readVersionedBody, readVersionQuery } from "@monti-cms/core/server";
import { z } from "zod";
import { listActions } from "../../actions";
import { addSnippet, deleteSnippet, getSnippetView, updateSnippetItem, updateSnippets } from "../../snippets";
import { aiStoreFor } from "../../store";

/**
 * Prompt snippets. Every request returns the whole changed list (`{ version, items }`). To edit, send `expectedVersion`;
 * a different version gives 409.
 *
 * - `GET`: config texts and added texts (`source: "config" | "added"`).
 * - `POST { expectedVersion, key, label, text }`: adds a text.
 * - `PATCH { expectedVersion, key, label?, text }`: edits one text (config texts: content only).
 * - `PUT { expectedVersion, texts: { key: content } }`: edits the content of several texts at once.
 * - `DELETE ?key=&expectedVersion=`: deletes an added text. Blocked if an action uses it in its instructions.
 */

const versioned = z.looseObject({ expectedVersion: z.number().int().min(0) });

export const GET = adminRoute(async ({ cms }) => ok(await getSnippetView(cms.site, aiStoreFor(cms))));

export const POST = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, ...item } = await readVersionedBody(request, versioned);
	return ok(await addSnippet(cms.site, aiStoreFor(cms), expectedVersion, item), { status: 201 });
});

export const PATCH = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, ...item } = await readVersionedBody(request, versioned);
	return ok(await updateSnippetItem(cms.site, aiStoreFor(cms), expectedVersion, item));
});

export const PUT = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, texts } = await readVersionedBody(request, versioned);
	return ok(await updateSnippets(cms.site, aiStoreFor(cms), expectedVersion, { texts }));
});

const readKey = (request: Request): string => {
	const key = new URL(request.url).searchParams.get("key");
	if (!key) throw new CmsError("key is required", "invalid_input");
	return key;
};

export const DELETE = adminRoute(async ({ request, cms }) => {
	const store = aiStoreFor(cms);
	const key = readKey(request);
	const expectedVersion = readVersionQuery(request);
	return ok(await deleteSnippet(cms.site, store, expectedVersion, key, await listActions(cms.site, store)));
});
