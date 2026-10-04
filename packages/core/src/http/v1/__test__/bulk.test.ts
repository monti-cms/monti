import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { CmsError } from "../../../adapters/postgres/content-store";
import { isItemCollection } from "../../../core/collections";
import { storedFields } from "../../../schema/derive";
import { POST as postBulk } from "../bulk/route";

const mockVerifyAdmin = vi.fn();

vi.mock("../../../adapters/auth", () => ({
	authGateway: {
		verifyAdmin: () => mockVerifyAdmin(),
	},
	AuthError: class AuthError extends Error {
		constructor(
			public code: string,
			message: string,
		) {
			super(message);
		}
	},
}));

const CAT_1 = "11111111-1111-4111-8111-111111111111";
const TAG_1 = "33333333-3333-4333-8333-333333333333";
const TAG_2 = "44444444-4444-4444-8444-444444444444";
const E1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STALE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** 항목 컬렉션을 가리키는 여러 개짜리 관계(블로그 예시 설정은 태그 `tagIds`). 컬렉션·필드 이름은 설정에서 찾는다. */
const MANY_FIELD = storedFields(contentCollection).find(
	({ field }) => field.kind === "relation" && field.many && isItemCollection(field.to),
)?.name;
if (!MANY_FIELD) throw new Error("bulk test: the content collection has no many relation to an item collection");

/** 발행 필수값을 채운 작업본 메타데이터(관계는 `CAT_1`, 블로그 예시 설정은 카테고리). */
let workingMetadata: Record<string, unknown> = {};

const working = (version: number) => ({
	collection: contentCollection,
	slug: "hello",
	metadata: { ...workingMetadata, [MANY_FIELD]: [TAG_1] },
	mdx: "body",
	version,
	folderId: null,
});

vi.mock("../../../container", () => ({
	getCmsContentStore: () => ({
		getWorkingReferences: vi.fn().mockResolvedValue([]),
		getWorking: vi.fn().mockImplementation(({ entryId }: { entryId: string }) => {
			if (entryId === MISSING) throw new CmsError("Entry not found", "not_found");
			return Promise.resolve(working(3));
		}),
		saveWorkingWithReferences: vi.fn().mockImplementation(({ entryId, expectedVersion }) => {
			if (expectedVersion !== 3) throw new CmsError("Conflict", "conflict", 9);
			return Promise.resolve({ version: 4, id: entryId });
		}),
		archiveEntry: vi.fn().mockImplementation(({ id, expectedVersion }: { id: string; expectedVersion: number }) => {
			if (expectedVersion !== 3) throw new CmsError("Conflict", "conflict", 9);
			return Promise.resolve({ version: 4, id });
		}),
		unarchiveEntry: vi.fn().mockImplementation(({ id }: { id: string }) => {
			return Promise.resolve({ version: 4, id });
		}),
		trashEntry: vi.fn().mockImplementation(({ id }: { id: string }) => {
			return Promise.resolve({ version: 4, id });
		}),
		publishEntry: vi.fn().mockImplementation(({ id }: { id: string }) => {
			return Promise.resolve({ version: 4, id });
		}),
	}),
}));

const postReq = (body: unknown) =>
	new NextRequest("http://localhost/api/cms/v1/bulk", {
		method: "POST",
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("M4-BE-1a Bulk route contract", () => {
	beforeAll(async () => {
		workingMetadata = await requiredMetadata(contentCollection, "Hello", async () => CAT_1);
	});

	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
	});

	it("returns per-item results with partial success", async () => {
		const res = await postBulk(
			postReq({
				op: "relation.add",
				field: MANY_FIELD,
				items: [
					{ id: E1, expectedVersion: 3 },
					{ id: STALE, expectedVersion: 2 },
					{ id: MISSING, expectedVersion: 1 },
				],
				ids: [TAG_2],
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			results: [
				{ id: E1, ok: true, version: 4 },
				{ id: STALE, ok: false, error: "conflict" },
				{ id: MISSING, ok: false, error: "not_found" },
			],
		});
	});

	it("rejects more than 100 items with 400", async () => {
		const res = await postBulk(
			postReq({
				op: "relation.add",
				field: MANY_FIELD,
				items: Array.from({ length: 101 }, (_, i) => ({
					id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
					expectedVersion: 1,
				})),
				ids: [TAG_1],
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects non-UUID item IDs with 400", async () => {
		const res = await postBulk(postReq({ op: "archive", items: [{ id: "e1", expectedVersion: 1 }] }));
		expect(res.status).toBe(400);
	});

	it("rejects unknown op with 400", async () => {
		const res = await postBulk(postReq({ op: "nope", items: [] }));
		expect(res.status).toBe(400);
	});

	it("dispatches lifecycle ops per item", async () => {
		const res = await postBulk(
			postReq({
				op: "archive",
				items: [
					{ id: E1, expectedVersion: 3 },
					{ id: E1, expectedVersion: 2 },
				],
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			results: [
				{ id: E1, ok: true, version: 4 },
				{ id: E1, ok: false, error: "conflict" },
			],
		});
	});
});
