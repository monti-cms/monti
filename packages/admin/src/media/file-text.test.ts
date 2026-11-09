import { describe, expect, it } from "vitest";
import { extensionLabel, formatBytes, previewUrl, sizeLabel } from "./file-text";

const file = (
	original: { url: string; width: number | null; height: number | null },
	web: typeof original | null = null,
) => ({
	original,
	web,
});

describe("what a file's line says", () => {
	it("09-1 a size in the unit a person reads", () => {
		expect(formatBytes(1_288_490)).toBe("1.2 MB");
		expect(formatBytes(14 * 1024 * 1024)).toBe("14 MB");
		expect(formatBytes(340 * 1024)).toBe("340 KB");
		expect(formatBytes(12)).toBe("12 B");
	});

	it("09-1 a file with no picture says what it is by its name", () => {
		expect(extensionLabel("price-list-2026.pdf")).toBe("PDF");
		expect(extensionLabel("noextension")).toBe("");
	});

	it("09-1 the web size is what shows, and what is measured, when there is one", () => {
		const big = file({ url: "/a", width: 4032, height: 2688 }, { url: "/b", width: 2400, height: 1600 });
		expect(sizeLabel(big)).toBe("2400×1600");
		expect(previewUrl(big)).toBe("/b");
		const small = file({ url: "/a", width: 800, height: 600 });
		expect(sizeLabel(small)).toBe("800×600");
		expect(previewUrl(small)).toBe("/a");
		expect(sizeLabel(file({ url: "/a", width: null, height: null }))).toBe("");
	});
});
