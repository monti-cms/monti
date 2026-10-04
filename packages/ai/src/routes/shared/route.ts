import { adminRoute, HttpError, json, readVersionedBody, readVersionQuery } from "@monti-cms/core/plugin/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { listActions } from "../../actions";
import { addShared, deleteShared, getSharedView, updateShared, updateSharedItem } from "../../shared";
import { getAiStore } from "../../store";

/**
 * 공통 문구(M8-4). 모든 요청은 바뀐 목록 전체(`{ version, items }`)를 돌려준다. 고칠 때는 `expectedVersion`을 보내고,
 * 버전이 다르면 409다.
 *
 * - `GET`: 설정 문구와 더한 문구(`source: "config" | "added"`).
 * - `POST { expectedVersion, key, label, text }`: 문구를 더한다.
 * - `PATCH { expectedVersion, key, label?, text }`: 문구 하나를 고친다(설정 문구는 내용만).
 * - `PUT { expectedVersion, texts: { 키: 내용 } }`: 여러 문구의 내용을 한 번에 고친다.
 * - `DELETE ?key=&expectedVersion=`: 더한 문구를 삭제한다. 지시문에서 쓰는 기능이 있으면 막는다.
 */

const versioned = z.looseObject({ expectedVersion: z.number().int().min(0) });

export const GET = adminRoute(async () => json(await getSharedView(getAiStore())));

export const POST = adminRoute(async ({ request }) => {
	const { expectedVersion, ...item } = await readVersionedBody(request, versioned);
	return json(await addShared(getAiStore(), expectedVersion, item), { status: 201 });
});

export const PATCH = adminRoute(async ({ request }) => {
	const { expectedVersion, ...item } = await readVersionedBody(request, versioned);
	return json(await updateSharedItem(getAiStore(), expectedVersion, item));
});

export const PUT = adminRoute(async ({ request }) => {
	const { expectedVersion, texts } = await readVersionedBody(request, versioned);
	return json(await updateShared(getAiStore(), expectedVersion, { texts }));
});

const readKey = (request: NextRequest): string => {
	const key = request.nextUrl.searchParams.get("key");
	if (!key) throw new HttpError(400, "invalid_input", "key is required");
	return key;
};

export const DELETE = adminRoute(async ({ request }) => {
	const store = getAiStore();
	const key = readKey(request);
	const expectedVersion = readVersionQuery(request);
	return json(await deleteShared(store, expectedVersion, key, await listActions(store)));
});
