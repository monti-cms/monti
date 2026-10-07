import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { createTranslator, translate } from "../../i18n";
import type { BlockAttribute, BlockDefinition } from "../define";
import { BUILTIN_BLOCKS } from "../definitions";
import { blockMessages } from "../messages";

const t = createTranslator(blockMessages, "en");
const siteT = testSite.createTranslator(blockMessages);

describe("core block label dictionary", () => {
	it("every Korean key exists in English, and English has every key", () => {
		const en = Object.keys(blockMessages.messages.en);
		expect(Object.keys(blockMessages.messages.ko ?? {}).filter((key) => !en.includes(key))).toEqual([]);
		expect(en.filter((key) => !(key in (blockMessages.messages.ko ?? {})))).toEqual([]);
	});

	it("block and attribute labels and descriptions come from the dictionary (the key is not shown as is)", () => {
		for (const block of BUILTIN_BLOCKS as readonly BlockDefinition[]) {
			expect(block.label).toBe(t(`${block.name}.label` as never));
			expect(block.label).not.toBe(`${block.name}.label`);
			for (const [name, attribute] of Object.entries(block.attributes) as [string, BlockAttribute][]) {
				const key = `${block.name}.${name}.label`;
				expect(attribute.label, key).toBe(t(key as never));
				if (attribute.description !== undefined) {
					expect(attribute.description).toBe(t(`${block.name}.${name}.description` as never));
				}
				for (const [value, label] of Object.entries(attribute.options ?? {})) {
					expect(label, `${key} option ${value}`).not.toMatch(/^option\./);
				}
			}
		}
	});

	it("a definition serializes to JSON with the label as a value", () => {
		const image = JSON.parse(JSON.stringify(BUILTIN_BLOCKS.find((block) => block.name === "image")));
		expect(image.label).toBe(t("image.label"));
		expect(image.attributes.alt.label).toBe(t("image.alt.label"));
		expect(image.attributes.align.options.left).toBe(t("option.left"));
		expect(image.editor.keywords).toContain("image");
	});

	it("the blocks of a site carry the labels in its admin language", () => {
		const image = JSON.parse(JSON.stringify(testSite.BLOCKS.find((block) => block.name === "image")));
		expect(image.label).toBe(siteT("image.label"));
		expect(image.attributes.alt.label).toBe(siteT("image.alt.label"));
		expect(image.attributes.align.options.left).toBe(siteT("option.left"));
		expect(image.editor.keywords).toContain("image");
	});

	it("uses the phrases the site overrode first", () => {
		expect(translate(blockMessages, "en", "image.label", undefined, { "cms.blocks": { "image.label": "Photo" } })).toBe(
			"Photo",
		);
		expect(translate(blockMessages, "ko", "image.label")).toBe("이미지");
		expect(translate(blockMessages, "en", "image.label")).toBe("Image");
	});
});
