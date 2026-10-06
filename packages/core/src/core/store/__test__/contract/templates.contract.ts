import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf } from "../../../../../test/stored-content";
import { bodyFromMdx } from "../../../../mdx/stored-document";
import type { ContentStore } from "../..";
import type { ContractSuite, StoreSession } from "./harness";

/** Contract of TemplateStore. */
export const templatesContract: ContractSuite = (factory) => {
	describe("TemplateStore: body templates", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
		});

		afterAll(async () => {
			await session.close();
		});

		it("stores a template as its document and the MDX written from it, on create and on update", async () => {
			const created = await store.createTemplate({
				name: "doc template",
				mdx: "Title\n=====\n\nSome _words_\n\n\n* one\n",
			});
			const expected = bodyFromMdx("Title\n=====\n\nSome _words_\n\n\n* one\n");
			expect(expected.doc).not.toBeNull();
			expect(created.mdx).toBe("# Title\n\nSome *words*\n\n- one\n");
			expect(contentOf(created.doc)).toEqual(contentOf(expected.doc));
			// Read back through the store (and the database) it is the same document, ids included.
			expect((await store.getTemplate(created.id)).doc).toEqual(created.doc);

			const updated = await store.updateTemplate({
				id: created.id,
				expectedVersion: created.version,
				mdx: "## Other\n",
			});
			expect(contentOf(updated.doc)).toEqual(contentOf(bodyFromMdx("## Other\n").doc));
			expect(updated.mdx).toBe("## Other\n");

			// A rename keeps the body and its document as they are.
			const renamed = await store.updateTemplate({
				id: created.id,
				expectedVersion: updated.version,
				name: "doc template 2",
			});
			expect(renamed.mdx).toBe(updated.mdx);
			expect(renamed.doc).toEqual(updated.doc);
		});

		it("stores a template that does not parse as an unparsed document of its text", async () => {
			const created = await store.createTemplate({ name: "broken template", mdx: "Words\n\n<Unclosed" });
			expect(created.mdx).toBe("Words\n\n<Unclosed");
			expect(created.doc.content).toEqual([
				expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: "Words\n\n<Unclosed" } }),
			]);
			const updated = await store.updateTemplate({ id: created.id, expectedVersion: created.version, mdx: "Fixed\n" });
			expect(contentOf(updated.doc)).toEqual(contentOf(bodyFromMdx("Fixed\n").doc));
			const broken = await store.updateTemplate({ id: created.id, expectedVersion: updated.version, mdx: "<Open" });
			expect(broken.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: "<Open" } });
			expect(broken.mdx).toBe("<Open");
		});

		it("2. supports CRUD with optimistic concurrency (version checking)", async () => {
			// Create
			const created = await store.createTemplate({
				name: "새 포스트 템플릿",
				mdx: "## 개요\n\n내용 작성",
			});
			expect(created.id).toBeDefined();
			expect(created.version).toBe(1);
			expect(created.name).toBe("새 포스트 템플릿");

			// Read by id
			const fetched = await store.getTemplate(created.id);
			expect(fetched.name).toBe("새 포스트 템플릿");

			const allTemplates = await store.listTemplates();
			expect(allTemplates.some((t) => t.id === created.id)).toBe(true);

			// Update with correct expectedVersion
			const updated = await store.updateTemplate({
				id: created.id,
				expectedVersion: 1,
				mdx: "## 개요 (수정됨)\n\n내용 작성",
			});
			expect(updated.version).toBe(2);
			expect(updated.mdx).toContain("## 개요 (수정됨)");

			// Update with stale expectedVersion throws conflict
			await expect(
				store.updateTemplate({
					id: created.id,
					expectedVersion: 1,
					mdx: "conflict!",
				}),
			).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));

			// Names are unique across the unified template list.
			await expect(
				store.createTemplate({
					name: "새 포스트 템플릿",
					mdx: "duplicate name",
				}),
			).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));
			await store.createTemplate({ name: "CASE TEST", mdx: "original" });
			await expect(store.createTemplate({ name: "case test", mdx: "duplicate" })).rejects.toThrowError(
				expect.objectContaining({ code: "conflict" }),
			);

			// Delete with stale version throws conflict
			await expect(store.deleteTemplate({ id: created.id, expectedVersion: 1 })).rejects.toThrowError(
				expect.objectContaining({ code: "conflict" }),
			);

			// Delete succeeds with current version
			await store.deleteTemplate({ id: created.id, expectedVersion: 2 });
			await expect(store.getTemplate(created.id)).rejects.toThrowError(expect.objectContaining({ code: "not_found" }));
		});
	});
};
