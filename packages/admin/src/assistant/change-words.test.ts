import type { Block } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import type { BlockNames } from "../screens/entry/compare-entries";
import { changedWords } from "./change-words";

const words: Record<string, string> = {
	"blocks.callout": "콜아웃",
	"editor.code.line": "줄 {n}",
	"code.effect.plus": "더함",
	"code.effect.highlight": "강조",
};
const say = (label: unknown) =>
	typeof label === "string"
		? (words[label] ?? label)
		: "key" in (label as object)
			? (words[(label as { key: string }).key] ?? (label as { key: string }).key)
			: (label as { ko: string }).ko;
const t = (message: string | { key: string }, values?: Record<string, string | number>) =>
	say(message).replace("{n}", String(values?.n ?? ""));

const names: BlockNames = {
	block: (type) =>
		type === "callout"
			? {
					label: "blocks.callout",
					fields: {
						tone: {
							label: { ko: "종류", en: "Kind" },
							options: { note: { ko: "노트", en: "Note" }, warning: { ko: "경고", en: "Warning" } },
						},
					},
				}
			: undefined,
	say,
} as BlockNames;

const code = (attrs: Record<string, unknown>): Block => ({
	id: "c",
	type: "codeBlock",
	attrs: { language: "ts", ...attrs },
	content: [{ type: "text", text: "a\nb" }],
});

describe("a changed block in one line, for the card in the conversation and the one-line view", () => {
	it("10-1 [AS-09] a callout whose kind changed says the kind before and after, though its words are the same", () => {
		const callout = (tone: string): Block => ({
			id: "n",
			type: "callout",
			attrs: { tone },
			children: [{ id: "p", type: "paragraph", content: [{ type: "text", text: "같은 말" }] }],
		});
		expect(changedWords(callout("note"), callout("warning"), names, t)).toEqual({
			before: "종류 노트",
			after: "종류 경고",
		});
	});

	it("10-1 [AS-09] a code block whose line effects changed says the lines and their effects, and one whose language or file name changed says them", () => {
		expect(changedWords(code({ lines: [] }), code({ lines: [{ name: "plus", start: 1, end: 2 }] }), names, t)).toEqual({
			before: "줄 2: —",
			after: "줄 2: 더함",
		});
		expect(changedWords(code({ title: "a.ts" }), code({ title: "b.ts", language: "js" }), names, t)).toEqual({
			before: "ts · a.ts",
			after: "js · b.ts",
		});
	});
});
