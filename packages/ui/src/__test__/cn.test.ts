import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
	it("lets a type scale role replace a component's own font size, with the same variant", () => {
		const classes = cn("text-monti-title md:text-monti-body", "text-monti-display md:text-monti-display").split(" ");
		expect(classes).toContain("text-monti-display");
		expect(classes).toContain("md:text-monti-display");
		expect(classes).not.toContain("text-monti-title");
		expect(classes).not.toContain("md:text-monti-body");
	});

	it("keeps a text color next to a type scale role", () => {
		const classes = cn("text-monti-caption", "text-monti-muted").split(" ");
		expect(classes).toContain("text-monti-caption");
		expect(classes).toContain("text-monti-muted");
	});

	it("lets a caller's color role replace a component's, and keeps the floating shadow beside a shadow color reset", () => {
		expect(cn("bg-monti-page text-monti-default", "bg-monti-inset text-monti-muted")).toBe(
			"bg-monti-inset text-monti-muted",
		);
		expect(cn("shadow-none", "shadow-monti-floating")).toBe("shadow-monti-floating");
	});

	it("treats named spacing as spacing, beside Tailwind's numbers", () => {
		expect(cn("gap-tight px-comfortable", "gap-section px-condensed")).toBe("gap-section px-condensed");
		expect(cn("px-2.5", "px-condensed")).toBe("px-condensed");
	});
});
