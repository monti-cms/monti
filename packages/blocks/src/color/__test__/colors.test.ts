import { translate } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { checkTextPalette, defaultTextPalette, type PaletteColor } from "../colors";
import { colorMessages } from "../messages";

const DEFAULT_TEXT_PALETTE = defaultTextPalette((key) => translate(colorMessages, "en", key));

const brand: PaletteColor = {
	id: "brand",
	name: "브랜드",
	fg: { light: "#4F46E5", dark: "#818cf8" },
	bg: { light: "#eef2ff", dark: "#1e1b4b" },
};

describe("text color list", () => {
	it("BLOCK-R1 reports an invalid list immediately", () => {
		expect(checkTextPalette(DEFAULT_TEXT_PALETTE)).toEqual([]);
		expect(checkTextPalette([brand, brand])).toEqual([
			expect.objectContaining({ path: "plugins.color.palette[1].id", code: "id" }),
		]);
		expect(checkTextPalette([{ ...brand, fg: { light: "red", dark: "#fff" } }])).toEqual([
			expect.objectContaining({ path: "plugins.color.palette[0].fg.light", code: "hex-color" }),
		]);
	});
});
