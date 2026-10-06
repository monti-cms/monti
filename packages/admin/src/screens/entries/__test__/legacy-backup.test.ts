import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import type { RecoveryRecord } from "../entry-editor-client";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { upgradeRecoveryRecord } from "../legacy-backup";

const paragraph = (id: string, text: string) => ({
	type: "paragraph",
	attrs: { id },
	content: [{ type: "text", text }],
});
const docOfParagraphs = (...paragraphs: ReturnType<typeof paragraph>[]): StoredDocument =>
	({ type: "doc", version: STORED_DOCUMENT_VERSION, content: paragraphs }) as unknown as StoredDocument;

const record = (snapshot: Record<string, unknown>, entryId = "entry-1"): RecoveryRecord =>
	({
		key: `admin:${entryId}`,
		entryId,
		baseFingerprint: "base",
		localFingerprint: "local",
		snapshot,
	}) as unknown as RecoveryRecord;

/** A snapshot as the old editor stored it: the body as text in `mdx`, no `doc`. */
const legacySnapshot = (mdx: string, changes: Record<string, unknown> = {}) => {
	const { doc: _doc, ...rest } = EMPTY_FORM as unknown as Record<string, unknown>;
	return { ...rest, ...changes, mdx };
};

describe("upgradeRecoveryRecord", () => {
	it("restores a copy with MDX text and no document as an unparsed document holding the text exactly", () => {
		const text = "# 제목\n\n<Callout>\n본문\n</Callout>\n";
		const upgraded = upgradeRecoveryRecord(record(legacySnapshot(text, { title: "쓰던 글" })));
		const snapshot = upgraded.snapshot as EntryForm & { mdx?: unknown };
		expect(snapshot.mdx).toBeUndefined();
		expect(snapshot.title).toBe("쓰던 글");
		expect(snapshot.doc.content).toHaveLength(1);
		expect(snapshot.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { format: "mdx", source: text } });
	});

	it("gives the restored text a block id", () => {
		const server = docOfParagraphs(paragraph("srv00001", "서버 본문"));
		const upgraded = upgradeRecoveryRecord(record(legacySnapshot("서버 본문")), server);
		const block = (upgraded.snapshot as EntryForm).doc.content[0] as { id?: string };
		expect(block.id).toBeTruthy();
	});

	it("restores an empty text as the empty body", () => {
		const upgraded = upgradeRecoveryRecord(record(legacySnapshot("")));
		expect((upgraded.snapshot as EntryForm).doc.content).toEqual([]);
	});

	it("compares a restored copy of a new entry with the empty form", () => {
		const upgraded = upgradeRecoveryRecord(record(legacySnapshot("글"), "new"));
		expect(upgraded.baseFingerprint).not.toBe("base");
	});

	it("keeps the document of a copy that already has one", () => {
		const doc = docOfParagraphs(paragraph("abcd1234", "이미 문서"));
		const upgraded = upgradeRecoveryRecord(record({ ...EMPTY_FORM, doc }));
		expect((upgraded.snapshot as EntryForm).doc.content).toEqual(doc.content);
		expect(upgraded.baseFingerprint).toBe("base");
	});
});
