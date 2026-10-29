import { describe, expect, it } from "vitest";
import { formatFileSize } from "../file-display";

describe("formatFileSize", () => {
	it("writes the number, a space and the unit, with one decimal only under 10 MB", () => {
		expect(formatFileSize(640)).toBe("640 B");
		expect(formatFileSize(180 * 1024)).toBe("180 KB");
		expect(formatFileSize(1.2 * 1024 * 1024)).toBe("1.2 MB");
		expect(formatFileSize(14.3 * 1024 * 1024)).toBe("14 MB");
	});
});
