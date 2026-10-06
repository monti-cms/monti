import { adminRoute, HttpError, json, readVersionedBody, readVersionQuery } from "@monti-cms/core/plugin/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { listActions } from "../../actions";
import { addShared, deleteShared, getSharedView, updateShared, updateSharedItem } from "../../shared";
import { aiStoreFor } from "../../store";

/**
 * Shared texts. Every request returns the whole changed list (`{ version, items }`). To edit, send `expectedVersion`;
 * a different version gives 409.
 *
 * - `GET`: config texts and added texts (`source: "config" | "added"`).
 * - `POST { expectedVersion, key, label, text }`: adds a text.
 * - `PATCH { expectedVersion, key, label?, text }`: edits one text (config texts: content only).
 * - `PUT { expectedVersion, texts: { key: content } }`: edits the content of several texts at once.
 * - `DELETE ?key=&expectedVersion=`: deletes an added text. Blocked if an action uses it in its instructions.
 */

const versioned = z.looseObject({ expectedVersion: z.number().int().min(0) });

export const GET = adminRoute(async ({ cms }) => json(await getSharedView(aiStoreFor(cms))));

export const POST = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, ...item } = await readVersionedBody(request, versioned);
	return json(await addShared(aiStoreFor(cms), expectedVersion, item), { status: 201 });
});

export const PATCH = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, ...item } = await readVersionedBody(request, versioned);
	return json(await updateSharedItem(aiStoreFor(cms), expectedVersion, item));
});

export const PUT = adminRoute(async ({ request, cms }) => {
	const { expectedVersion, texts } = await readVersionedBody(request, versioned);
	return json(await updateShared(aiStoreFor(cms), expectedVersion, { texts }));
});

const readKey = (request: NextRequest): string => {
	const key = request.nextUrl.searchParams.get("key");
	if (!key) throw new HttpError(400, "invalid_input", "key is required");
	return key;
};

export const DELETE = adminRoute(async ({ request, cms }) => {
	const store = aiStoreFor(cms);
	const key = readKey(request);
	const expectedVersion = readVersionQuery(request);
	return json(await deleteShared(store, expectedVersion, key, await listActions(store)));
});
