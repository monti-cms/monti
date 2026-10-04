import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_PALETTE, type PaletteColor, paletteOf, validateTextPalette } from "../colors";

const brand: PaletteColor = {
	id: "brand",
	name: "브랜드",
	fg: { light: "#4F46E5", dark: "#818cf8" },
	bg: { light: "#eef2ff", dark: "#1e1b4b" },
};

describe("글자색 목록", () => {
	it("기본 목록이나 사이트 목록에서 지금 색의 프리셋을 찾는다", () => {
		expect(paletteOf("fg", { fg: "#dc2626" })?.id).toBe("red");
		expect(paletteOf("fg", { fg: "#4f46e5" }, [brand])?.id).toBe("brand");
		expect(paletteOf("fg", { fg: "#4f46e5" })).toBeUndefined();
	});

	it("틀린 목록은 바로 알린다", () => {
		expect(() => validateTextPalette(DEFAULT_TEXT_PALETTE)).not.toThrow();
		expect(() => validateTextPalette([brand, brand])).toThrow(/duplicated/);
		expect(() => validateTextPalette([{ ...brand, fg: { light: "red", dark: "#fff" } }])).toThrow(/hex/);
	});
});
