import { translate } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { defaultTextPalette, type PaletteColor, paletteOf, validateTextPalette } from "../colors";
import { colorMessages } from "../messages";

const DEFAULT_TEXT_PALETTE = defaultTextPalette((key) => translate(colorMessages, "en", key));

const brand: PaletteColor = {
	id: "brand",
	name: "브랜드",
	fg: { light: "#4F46E5", dark: "#818cf8" },
	bg: { light: "#eef2ff", dark: "#1e1b4b" },
};

describe("text color list", () => {
	it("finds the preset for the current color in the default or site list", () => {
		expect(paletteOf("fg", { fg: "#dc2626" }, DEFAULT_TEXT_PALETTE)?.id).toBe("red");
		expect(paletteOf("fg", { fg: "#4f46e5" }, [brand])?.id).toBe("brand");
		expect(paletteOf("fg", { fg: "#4f46e5" }, DEFAULT_TEXT_PALETTE)).toBeUndefined();
	});

	it("reports an invalid list immediately", () => {
		expect(() => validateTextPalette(DEFAULT_TEXT_PALETTE)).not.toThrow();
		expect(() => validateTextPalette([brand, brand])).toThrow(/duplicated/);
		expect(() => validateTextPalette([{ ...brand, fg: { light: "red", dark: "#fff" } }])).toThrow(/hex/);
	});
});
