import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf, docOf } from "../../../../../test/stored-content";
import { forEachBlock, isBlockId, withoutBlockIds } from "../../../../mdx/block-ids";
import {
	emptyStoredDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
	unparsedDocument,
} from "../../../../mdx/stored-document";
import type { ContentStore } from "../..";
import type { ContractSuite, StoreSession } from "./harness";

/** A document as a text read gives it: no block ids, so the store pairs its blocks with the body it replaces. */
const withoutIds = (doc: StoredDocument): StoredDocument => ({ ...doc, content: withoutBlockIds(doc.content) });

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

		it("stores a template as its document, with an id on every block, on create and on update", async () => {
			const doc = docOf("Title\n=====\n\nSome _words_\n\n\n* one\n");
			const created = await store.createTemplate({ name: "doc template", doc });
			expect(contentOf(created.doc)).toEqual(contentOf(doc));
			let blocks = 0;
			forEachBlock(created.doc.content, (block) => {
				blocks += 1;
				expect(isBlockId(block.id)).toBe(true);
			});
			expect(blocks).toBeGreaterThan(0);
			// Read back through the store (and the database) it is the same document, ids included.
			expect((await store.getTemplate(created.id)).doc).toEqual(created.doc);

			const updated = await store.updateTemplate({
				id: created.id,
				expectedVersion: created.version,
				doc: docOf("## Other\n"),
			});
			expect(contentOf(updated.doc)).toEqual(contentOf(docOf("## Other\n")));

			// A rename keeps the body and its document as they are.
			const renamed = await store.updateTemplate({
				id: created.id,
				expectedVersion: updated.version,
				name: "doc template 2",
			});
			expect(renamed.doc).toEqual(updated.doc);
		});

		it("keeps the block ids of the body a document replaces where its blocks pair up", async () => {
			const created = await store.createTemplate({ name: "ids template", doc: docOf("First\n\nSecond\n") });
			const [first, second] = created.doc.content;
			const updated = await store.updateTemplate({
				id: created.id,
				expectedVersion: created.version,
				doc: withoutIds(docOf("First\n\nSecond, edited\n\nThird\n")),
			});
			expect(updated.doc.content[0]?.id).toBe(first?.id);
			expect(updated.doc.content[1]?.id).toBe(second?.id);
			expect(updated.doc.content[2]?.id).not.toBe(first?.id);
		});

		it("creates an empty template without a document, and keeps a text that is not a document as an unparsed one", async () => {
			const empty = await store.createTemplate({ name: "empty template" });
			expect(empty.doc).toEqual(emptyStoredDocument());
			expect(empty.doc.version).toBe(STORED_DOCUMENT_VERSION);

			const text = "Words\n\n<Unclosed";
			const kept = await store.createTemplate({ name: "unparsed template", doc: unparsedDocument(text) });
			expect(kept.doc.content).toEqual([
				expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: text } }),
			]);
			expect((await store.getTemplate(kept.id)).doc).toEqual(kept.doc);
		});

		it("rejects a body that is not a stored document", async () => {
			await expect(store.createTemplate({ name: "not a doc", doc: "## text" })).rejects.toThrowError(
				expect.objectContaining({ code: "invalid_input" }),
			);
			const created = await store.createTemplate({ name: "stays a doc" });
			await expect(
				store.updateTemplate({ id: created.id, expectedVersion: created.version, doc: { type: "doc", content: 1 } }),
			).rejects.toThrowError(expect.objectContaining({ code: "invalid_input" }));
			expect((await store.getTemplate(created.id)).doc).toEqual(created.doc);
		});

		it("supports CRUD with optimistic concurrency (version checking)", async () => {
			// Create
			const created = await store.createTemplate({
				name: "새 포스트 템플릿",
				doc: docOf("## 개요\n\n내용 작성"),
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
				doc: docOf("## 개요 (수정됨)\n\n내용 작성"),
			});
			expect(updated.version).toBe(2);
			expect(JSON.stringify(updated.doc)).toContain("개요 (수정됨)");

			// Update with stale expectedVersion throws conflict
			await expect(
				store.updateTemplate({
					id: created.id,
					expectedVersion: 1,
					doc: docOf("conflict!"),
				}),
			).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));

			// Names are unique across the unified template list.
			await expect(
				store.createTemplate({
					name: "새 포스트 템플릿",
					doc: docOf("duplicate name"),
				}),
			).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));
			await store.createTemplate({ name: "CASE TEST", doc: docOf("original") });
			await expect(store.createTemplate({ name: "case test", doc: docOf("duplicate") })).rejects.toThrowError(
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
