import { describe, expect, it } from "vitest";
import { previewUrl, sizeLabel } from "./file-text";

const file = (
	original: { url: string; width: number | null; height: number | null },
	web: typeof original | null = null,
) => ({
	original,
	web,
});

describe("what a file's line says", () => {
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
