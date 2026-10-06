import "@monti-cms/core/client";
import { createFormatRegistry } from "@monti-cms/core/format";
import { describe, expect, it, vi } from "vitest";
import { DOCUMENT_COLLECTIONS } from "../../../core/src/core/collections";
import { createContentService } from "../../../core/src/services/content-service";
import type { Reference, ServiceInput, StorePort } from "../../../core/src/services/index";
import { prepareSnapshot as prepareCore, validateForPublish } from "../../../core/src/services/index";
import { mdxFormat } from "../format";

/**
 * What the write path reports for MDX text that cannot become a document, or that holds a reference that is not a value: these are rules of the `mdx` format,
 * so they are tested with it (the core tests use a plain test format).
 */

const content = DOCUMENT_COLLECTIONS[0] as string;
const formats = async () => createFormatRegistry([mdxFormat]);
const prepareSnapshot = (value: unknown, options: Parameters<typeof prepareCore>[1] = {}) =>
	prepareCore(value as ServiceInput, { ...options, import: { formats: createFormatRegistry([mdxFormat]) } });
const mdxInput = (body: string) => ({ collection: content, slug: "a", metadata: {}, format: "mdx", body });

describe("MDX that cannot become a document", () => {
	it("rejects retired ContentLink with a migration message", async () => {
		const snap = await prepareSnapshot(mdxInput('<ContentLink targetId="123e4567-e89b-12d3-a456-426614174000" />'));
		expect(snap.issues).toContainEqual(
			expect.objectContaining({
				code: "mdx_error",
				params: expect.objectContaining({ reason: "retired_jsx_element", name: "ContentLink" }),
			}),
		);
	});

	it.each([
		// A reference that is an expression is not a value: the text is rejected before it can become a document.
		["<Image mediaId={dynamicId} />", "mdx_error"],
		['<Image mediaId="not-a-uuid" alt="a" />', "invalid_reference_id"],
		["<File />", "missing_media_id"],
		["<File mediaId={dynamicId} />", "mdx_error"],
		['<File mediaId="not-a-uuid" />', "invalid_reference_id"],
	])("creates structured issues for dynamic IDs: %s", async (mdx, expectedIssue) => {
		const snap = await prepareSnapshot(mdxInput(mdx));
		expect(snap.issues).toContainEqual(expect.objectContaining({ code: expectedIssue }));
		expect(snap.references).toEqual([]);
	});

	it("retains trusted previous refs marked stale on MDX syntax error and keeps the exact text", async () => {
		const mdx = "</Invalid>";
		const previousReferences: Reference[] = [
			{
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: false,
				occurrences: [{ type: "body", blockId: "abcd1234" }],
			},
		];
		const snap = await prepareSnapshot(mdxInput(mdx), { previousReferences });

		expect(snap.issues).toContainEqual(expect.objectContaining({ code: "mdx_error" }));
		// The text is kept as it was given, in an unparsed body.
		expect(snap.doc.content).toEqual([
			expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: mdx } }),
		]);
		expect(snap.issues).toContainEqual(expect.objectContaining({ code: "unparsed_body" }));
		expect(snap.references).toHaveLength(1);
		expect(snap.references[0]).toMatchObject({
			kind: "entry",
			targetId: "123e4567-e89b-12d3-a456-426614174000",
			isStale: true,
		});
	});

	it("keeps the analyser positions in blocking issues", async () => {
		const snapshot = await prepareSnapshot({
			...mdxInput('First line\n<ContentLink targetId="bad" />'),
			metadata: { title: "Memo" },
			slug: "memo",
		});
		expect(snapshot.issues).toContainEqual(
			expect.objectContaining({ code: "mdx_error", position: { line: 2, column: 1 } }),
		);
	});
});

describe("MDX with front matter", () => {
	it("preserves frontmatter bytes, draft is allowed, but produces frontmatter_present issue making it not ready", async () => {
		const mdx = "---\ntitle: test\n---\nHello";
		const storePort: StorePort = {
			getWorkingReferences: vi.fn(),
			archiveEntry: vi.fn(),
			unarchiveEntry: vi.fn(),
			trashEntry: vi.fn(),
			publishEntry: vi.fn(),
			getWorking: vi.fn(),
			createEntryWithReferences: vi.fn().mockResolvedValue(undefined),
			saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
		};
		const service = createContentService(storePort, { formats });

		await service.createDraft(mdxInput(mdx) as unknown as ServiceInput);

		const callArg = vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0];
		expect(callArg.snapshot.doc.content).toEqual([
			expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: mdx } }),
		]);
		expect(callArg.snapshot.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));

		const validation = validateForPublish(callArg.snapshot, { targets: [], media: [] });
		expect(validation.ready).toBe(false);
		expect(validation.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));
	});
});
