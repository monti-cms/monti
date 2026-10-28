import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

describe("menu widths", () => {
	it("never fixes a menu or popup to its anchor's width without a minimum of its own", () => {
		// A menu opened from a small icon button must not be as narrow as that button. `min-w-(--anchor-width)` (a select as wide as its trigger) is fine,
		// and so is a width fixed to the anchor beside a min-width of the popup's own (a combobox under its input).
		const FIXED_TO_ANCHOR = /(^|[\s"'])w-\(--anchor-width\)/;
		const OWN_MINIMUM = /(^|[\s"'])min-w-/;
		const parts = readdirSync(SRC).filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"));
		expect(parts.length).toBeGreaterThan(20);
		for (const file of parts) {
			const source = readFileSync(join(SRC, file), "utf8");
			if (FIXED_TO_ANCHOR.test(source)) expect(source, file).toMatch(OWN_MINIMUM);
		}
	});
});
