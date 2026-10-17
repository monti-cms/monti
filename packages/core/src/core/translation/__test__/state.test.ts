import { describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import { STORED_DOCUMENT_VERSION, unparsedDocument } from "../../../doc/stored-document";
import { confirmedSourceState, MAX_TRANSLATION_BYTES, parseTranslationState } from "../state";

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

	it("lifts a version 1 document to the current version, a code block to its code and annotations", () => {
		const fence = { language: "ts", meta: "", value: "// @line plus\nconst a = 1;" };
		const old = { version: 1, type: "doc", content: [{ type: "codeBlock", attrs: fence, id: "aaaaaaaa" }] };
		const state = parseTranslationState({ version: 4, baseDoc: old });
		expect(state?.baseDoc.version).toBe(STORED_DOCUMENT_VERSION);
		expect(state?.baseDoc.content[0]?.attrs).toEqual({
			annotations: { lines: [{ end: 1, name: "plus", start: 0 }] },
			code: "const a = 1;",
			language: "ts",
			meta: "",
		});
		expect(state?.baseDoc.content[0]?.id).toBe("aaaaaaaa");
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
			version: 2,
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
