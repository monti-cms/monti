import { describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import { STORED_DOCUMENT_VERSION, unparsedDocument } from "../../../doc/stored-document";
import { confirmedSourceState, MAX_TRANSLATION_BYTES, parseTranslationState, sourceHasChanged } from "../state";

const doc = docOf("하나\n\n둘\n");

describe("translation state", () => {
	it("null is a source", () => {
		expect(parseTranslationState(null)).toBeNull();
	});

	it("reads version 4 as it is", () => {
		expect(parseTranslationState({ version: 4, baseDoc: doc })).toEqual({ version: 4, baseDoc: doc });
	});

	it("sorts the keys of the document as a stored document is", () => {
		const reordered = {
			version: STORED_DOCUMENT_VERSION,
			type: "doc",
			content: [{ type: "paragraph", id: "aaaaaaaa" }],
		};
		const state = parseTranslationState({ version: 4, baseDoc: reordered });
		expect(JSON.stringify(state?.baseDoc)).toBe(
			`{"content":[{"id":"aaaaaaaa","type":"paragraph"}],"type":"doc","version":${STORED_DOCUMENT_VERSION}}`,
		);
	});

	it("rejects a state with an invalid document", () => {
		for (const baseDoc of [
			{ type: "doc" },
			{ type: "doc", version: 999, content: [] },
			"문서",
			3,
			[],
			null,
			undefined,
		]) {
			expect(parseTranslationState({ version: 4, baseDoc }), JSON.stringify(baseDoc)).toBeUndefined();
		}
	});

	it("rejects a wrong shape", () => {
		for (const value of [
			undefined,
			"state",
			[],
			{ version: 1, units: [] },
			{ version: 5, baseDoc: doc },
			{ version: 4 },
			{ version: 4, baseDoc: doc, extra: 1 },
			{ version: 2, baseSource: "" },
			{ version: 3, baseSource: "", baseDoc: null },
		]) {
			expect(parseTranslationState(value), JSON.stringify(value)).toBeUndefined();
		}
	});

	it("limits the size of the whole state", () => {
		const big = {
			type: "doc",
			version: 3,
			content: [{ type: "paragraph", attrs: { v: "a".repeat(MAX_TRANSLATION_BYTES) } }],
		};
		expect(parseTranslationState({ version: 4, baseDoc: big })).toBeUndefined();
	});

	it("confirming a source keeps its document", () => {
		expect(confirmedSourceState(doc)).toEqual({ version: 4, baseDoc: doc });
		const unparsed = unparsedDocument("원문 <Box");
		expect(parseTranslationState(confirmedSourceState(unparsed))).toEqual({ version: 4, baseDoc: unparsed });
	});
});

describe("whether the source changed since a translation was confirmed", () => {
	it("is false for the same text, even when the block ids differ", () => {
		const withIds = { ...doc, content: doc.content.map((node, index) => ({ ...node, id: `block00${index}` })) };
		expect(sourceHasChanged(doc, withIds)).toBe(false);
	});

	it("is true when the text changed", () => {
		expect(sourceHasChanged(docOf("하나\n\n셋\n"), doc)).toBe(true);
	});

	it("is true when a block was added", () => {
		expect(sourceHasChanged(docOf("하나\n\n둘\n\n셋\n"), doc)).toBe(true);
	});
});
