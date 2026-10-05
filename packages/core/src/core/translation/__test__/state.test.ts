import { describe, expect, it } from "vitest";
import { bodyFromMdx } from "../../../mdx";
import { confirmedSourceState, MAX_TRANSLATION_BYTES, parseTranslationState } from "../state";

const body = bodyFromMdx("하나\n\n둘\n");
const doc = body.doc;

/** A source that fits the limit alone but not once a document is counted too. */
const nearLimit = "a".repeat(MAX_TRANSLATION_BYTES - 1024);
const bulky = {
	type: "doc",
	version: 1,
	content: [{ type: "paragraph", content: [{ type: "text", text: "b".repeat(2048) }] }],
};

describe("translation state", () => {
	it("null is a source", () => {
		expect(parseTranslationState(null)).toBeNull();
	});

	it("lifts version 2 to version 3 without a document", () => {
		expect(parseTranslationState({ version: 2, baseSource: "원문\n" })).toEqual({
			version: 3,
			baseSource: "원문\n",
			baseDoc: null,
		});
	});

	it("reads version 3 with a document or without", () => {
		expect(doc).not.toBeNull();
		expect(parseTranslationState({ version: 3, baseSource: body.mdx, baseDoc: doc })).toEqual({
			version: 3,
			baseSource: body.mdx,
			baseDoc: doc,
		});
		expect(parseTranslationState({ version: 3, baseSource: "원문\n", baseDoc: null })).toEqual({
			version: 3,
			baseSource: "원문\n",
			baseDoc: null,
		});
	});

	it("sorts the keys of the document as a stored document is", () => {
		const reordered = { version: 2, type: "doc", content: [{ type: "paragraph", id: "aaaaaaaa" }] };
		const state = parseTranslationState({ version: 3, baseSource: "", baseDoc: reordered });
		expect(JSON.stringify(state?.baseDoc)).toBe(
			'{"content":[{"id":"aaaaaaaa","type":"paragraph"}],"type":"doc","version":2}',
		);
	});

	it("lifts a version 1 document to the current version, a code block to its code and annotations", () => {
		const fence = { language: "ts", meta: "", value: "// @line plus\nconst a = 1;" };
		const old = { version: 1, type: "doc", content: [{ type: "codeBlock", attrs: fence, id: "aaaaaaaa" }] };
		const state = parseTranslationState({ version: 3, baseSource: "", baseDoc: old });
		expect(state?.baseDoc?.version).toBe(2);
		expect(state?.baseDoc?.content[0]?.attrs).toEqual({
			annotations: { lines: [{ end: 1, name: "plus", start: 0 }] },
			code: "const a = 1;",
			language: "ts",
			meta: "",
		});
		expect(state?.baseDoc?.content[0]?.id).toBe("aaaaaaaa");
	});

	it("rejects a version 3 state with an invalid document", () => {
		for (const baseDoc of [{ type: "doc" }, { type: "doc", version: 999, content: [] }, "문서", 3, [], undefined]) {
			expect(parseTranslationState({ version: 3, baseSource: "", baseDoc }), JSON.stringify(baseDoc)).toBeUndefined();
		}
		expect(parseTranslationState({ version: 3, baseSource: "" })).toBeUndefined();
	});

	it("rejects a wrong shape", () => {
		for (const value of [
			undefined,
			"state",
			[],
			{ version: 1, units: [] },
			{ version: 4, baseSource: "", baseDoc: null },
			{ version: 2 },
			{ version: 2, baseSource: 1 },
			{ version: 2, baseSource: "", baseDoc: null },
			{ version: 3, baseSource: "", baseDoc: null, extra: 1 },
		]) {
			expect(parseTranslationState(value), JSON.stringify(value)).toBeUndefined();
		}
	});

	it("limits the size of the whole state", () => {
		expect(parseTranslationState({ version: 2, baseSource: "가".repeat(MAX_TRANSLATION_BYTES / 3) })).toBeUndefined();
		expect(parseTranslationState({ version: 2, baseSource: nearLimit })).not.toBeUndefined();
		expect(parseTranslationState({ version: 3, baseSource: nearLimit, baseDoc: bulky })).toBeUndefined();
	});

	it("confirming a source keeps its document, unless the state would be too large", () => {
		expect(confirmedSourceState(body.mdx, doc)).toEqual({ version: 3, baseSource: body.mdx, baseDoc: doc });
		expect(confirmedSourceState("원문\n", null)).toEqual({ version: 3, baseSource: "원문\n", baseDoc: null });
		const state = confirmedSourceState(nearLimit, bulky as never);
		expect(state).toEqual({ version: 3, baseSource: nearLimit, baseDoc: null });
		expect(parseTranslationState(state)).toEqual(state);
	});
});
