import { describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import { defineBlock } from "../../../blocks/define";
import { unparsedDocument } from "../../../doc/stored-document";
import { compareStructure as compareDocumentStructure, readableAttributesByType } from "../skeleton";

describe("translation structure check", () => {
	it("human-readable attributes are decided by the block definition", () => {
		const card = defineBlock({
			name: "card",
			label: "카드",
			syntax: { kind: "container", directive: "card" },
			component: "Card",
			attributes: {
				heading: { type: "string", label: "머리말", translatable: true },
				tone: { type: "string", label: "색" },
			},
			children: { blocks: ["face"] },
			editor: { view: "opaque" },
		});
		const face = defineBlock({
			name: "face",
			label: "면",
			syntax: { kind: "container", directive: "face" },
			component: "Face",
			attributes: { name: { type: "string", label: "이름", translatable: true } },
			editor: { view: "opaque" },
		});
		const deck = defineBlock({
			name: "deck",
			label: "묶음",
			syntax: { kind: "container", directive: "deck" },
			component: "Deck",
			attributes: { first: { type: "string", label: "처음 면", childValue: "name" } },
			children: { blocks: ["face"] },
			editor: { view: "opaque" },
		});
		const readable = readableAttributesByType([card, face, deck]);
		expect([...(readable.get("card") ?? [])]).toEqual(["heading"]);
		// An attribute pointing to a translatable child attribute changes too (tab name ↔ initially open tab).
		expect([...(readable.get("deck") ?? [])]).toEqual(["first"]);
		// Nodes are stored by block name, so the renderer name is not a kind.
		expect(readable.has("Card")).toBe(false);
		expect(readable.get("link")).toEqual(new Set(["title"]));
	});
});

describe("structure check of documents", () => {
	it("compares the stored documents of the source and the translation", () => {
		expect(compareDocumentStructure(docOf("첫 문단\n\n## 제목"), docOf("First\n\n## Title"))).toEqual({ ok: true });
		expect(compareDocumentStructure(docOf("첫 문단"), docOf("First\n\nSecond")).ok).toBe(false);
	});

	it("ignores block ids", () => {
		const source = docOf("가\n\n나");
		const translated = docOf("a\n\nb");
		expect(source.content[0]?.id).not.toBe(translated.content[0]?.id);
		expect(compareDocumentStructure(source, translated)).toEqual({ ok: true });
	});

	it("fails for a translation or a source that is an unparsed body", () => {
		expect(compareDocumentStructure(docOf("a"), unparsedDocument("<Box"))).toMatchObject({
			ok: false,
			code: "mdx_error",
		});
		expect(compareDocumentStructure(unparsedDocument("<Box"), docOf("a"))).toMatchObject({
			ok: false,
			code: "source_unreadable",
		});
	});
});
