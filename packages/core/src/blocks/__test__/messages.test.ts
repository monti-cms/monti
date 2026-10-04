import { describe, expect, it } from "vitest";
import { createTranslator, translate } from "../../i18n";
import type { BlockAttribute, BlockDefinition } from "../define";
import { BUILTIN_BLOCKS } from "../definitions";
import { blockMessages } from "../messages";

const t = createTranslator(blockMessages);

describe("본체 블록 이름표 사전", () => {
	it("한국어 키는 모두 영어에 있고, 영어는 모든 키를 가진다", () => {
		const en = Object.keys(blockMessages.messages.en);
		expect(Object.keys(blockMessages.messages.ko ?? {}).filter((key) => !en.includes(key))).toEqual([]);
		expect(en.filter((key) => !(key in (blockMessages.messages.ko ?? {})))).toEqual([]);
	});

	it("블록·속성의 이름표와 설명은 사전에서 온다(키가 그대로 보이지 않는다)", () => {
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

	it("정의는 JSON으로 직렬화해도 이름표를 값으로 담는다", () => {
		const image = JSON.parse(JSON.stringify(BUILTIN_BLOCKS.find((block) => block.name === "image")));
		expect(image.label).toBe(t("image.label"));
		expect(image.attributes.alt.label).toBe(t("image.alt.label"));
		expect(image.attributes.align.options.left).toBe(t("option.left"));
		expect(image.editor.keywords).toContain("image");
	});

	it("사이트가 덮어쓴 문구를 먼저 쓴다", () => {
		expect(translate(blockMessages, "en", "image.label", undefined, { "cms.blocks": { "image.label": "Photo" } })).toBe(
			"Photo",
		);
		expect(translate(blockMessages, "ko", "image.label")).toBe("이미지");
		expect(translate(blockMessages, "en", "image.label")).toBe("Image");
	});
});
