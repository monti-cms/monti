import { NextRequest } from "next/server";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, fillRequiredMetadata, requiredFields } from "../../../../../test/any-site";
import { seedSave } from "../../../../adapters/postgres/__test__/seed";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "../../../../adapters/postgres/__test__/test-database";
import {
	type ContentStore,
	createContentStore,
	migrateContentStore,
} from "../../../../adapters/postgres/content-store";
import { type Collection, isItemCollection } from "../../../../core/collections";
import { storedFields } from "../../../../schema/derive";
import type { PublicApiOptions } from "../options";

const state = vi.hoisted(() => ({ store: null as unknown, publicApi: undefined as unknown }));
vi.mock("../../../../container", () => ({ getCmsContentStore: () => state.store, getCmsAuth: () => ({}) }));
vi.mock("../../../../server/resolved", () => ({
	get cmsServerConfig() {
		return { publicApi: state.publicApi };
	},
}));

import { createCmsRouteHandler } from "../../../router";

/** 필수가 아닌, 항목 컬렉션을 가리키는 관계(필수값 채우기가 모든 글에 넣지 않는 필드). */
const relation = (() => {
	const required = new Set(requiredFields(contentCollection).map(({ name }) => name));
	for (const { name, field } of storedFields(contentCollection)) {
		if (field.kind === "relation" && isItemCollection(field.to) && !required.has(name)) {
			return { name, to: field.to as Collection, many: Boolean(field.many) };
		}
	}
	return undefined;
})();

/** 공개 JSON API(M14-6). 서버 설정 `publicApi`로 켜고, 로그인 없이 공개본만 돌려준다. */
describe("공개 JSON API", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let targetSlug = "";
	let targetId = "";

	const get = async (path: string) => {
		const [pathname, query = ""] = path.split("?");
		const response = await createCmsRouteHandler().GET(
			new NextRequest(`http://localhost/api/cms/${pathname}${query ? `?${query}` : ""}`),
			{ params: Promise.resolve({ path: (pathname ?? "").split("/") }) },
		);
		return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
	};

	const publish = async (slug: string, metadata: Record<string, unknown> = {}) => {
		const draft = await store.createEntryWithReferences({
			snapshot: {
				collection: contentCollection,
				slug,
				metadata: { title: `Title ${slug}`, ...metadata },
				mdx: `Body ${slug}`,
				schemaVersion: 1,
				contentHash: `hash-${slug}`,
				references: [],
				issues: [],
				imageSources: [],
			} as never,
			references: [],
		});
		return store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		const { relationTarget } = fillRequiredMetadata(store);
		state.store = store;
		if (relation) {
			targetId = await relationTarget(relation.to);
			targetSlug = (await store.getEntry(targetId)).publishedSlug ?? "";
		}
		await publish("public-1");
		await publish("public-2", relation ? { [relation.name]: relation.many ? [targetId] : targetId } : {});
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("설정하지 않으면 공개 API는 404다", async () => {
		state.publicApi = undefined;
		expect((await get("v1/public/entries")).status).toBe(404);
	});

	it("목록: 쪽 나누기·관계 필터(대상 주소)·캐시하지 않음, 잘못된 질의는 400", async () => {
		state.publicApi = {
			collections: [contentCollection],
			filters: relation ? { related: relation.name } : {},
		} satisfies PublicApiOptions;
		const list = await get("v1/public/entries?pageSize=1");
		expect(list.status).toBe(200);
		expect(list.cache).toBe("no-store");
		expect(list.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
		expect(list.body.items[0]).toMatchObject({ slug: "public-2", collection: contentCollection });
		expect(list.body.items[0]).not.toHaveProperty("body");
		expect(list.body.items[0]).not.toHaveProperty("version");

		if (relation) {
			const filtered = await get(`v1/public/entries?related=${encodeURIComponent(targetSlug)}`);
			expect(filtered.body.items.map((item: { slug: string }) => item.slug)).toEqual(["public-2"]);
			expect((await get("v1/public/entries?related=no-such-target")).body).toMatchObject({ items: [], total: 0 });
		}
		expect((await get("v1/public/entries?pageSize=101")).status).toBe(400);
		expect((await get("v1/public/entries?collection=nope")).status).toBe(400);
	});

	it("단건: 본문을 싣고, 옛 주소면 정규 주소를 알리며, 없으면 404다", async () => {
		state.publicApi = { collections: [contentCollection] } satisfies PublicApiOptions;
		const one = await get(`v1/public/entries/${contentCollection}/public-1`);
		expect(one.body).toMatchObject({ entry: { slug: "public-1", body: "Body public-1" }, address: { isAlias: false } });

		const entry = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "public-1" });
		if (!entry) throw new Error("missing");
		const saved = await seedSave(store, entry.id, {
			expectedVersion: entry.version,
			slug: "public-1-renamed",
			metadata: entry.working.metadata,
			mdx: entry.working.mdx,
		});
		await store.publishEntry({ id: entry.id, expectedVersion: saved.version });
		const alias = await get(`v1/public/entries/${contentCollection}/public-1`);
		expect(alias.body.address).toEqual({ slug: "public-1-renamed", isAlias: true });
		expect((await get(`v1/public/entries/${contentCollection}/missing`)).status).toBe(404);
	});

	it("toJson이 null이면 그 글을 숨긴다(목록에서 빠지고 단건은 404)", async () => {
		state.publicApi = {
			collections: [contentCollection],
			toJson: (entry) => (entry.slug === "public-2" ? null : { s: entry.slug }),
		} satisfies PublicApiOptions;
		const list = await get("v1/public/entries");
		expect(list.body.items.map((item: { s: string }) => item.s)).not.toContain("public-2");
		expect((await get(`v1/public/entries/${contentCollection}/public-2`)).status).toBe(404);
	});

	it("사이트가 응답 모양을 정할 수 있다(toJson)", async () => {
		state.publicApi = {
			collections: [contentCollection],
			toJson: (entry, { body }) => ({ s: entry.slug, hasBody: body }),
		} satisfies PublicApiOptions;
		expect((await get("v1/public/entries?pageSize=1")).body.items[0]).toEqual({ s: "public-2", hasBody: false });
	});
});
