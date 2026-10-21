import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
	it("lets a type scale role replace a component's own font size, with the same variant", () => {
		const classes = cn("text-base md:text-sm", "text-monti-display md:text-monti-display").split(" ");
		expect(classes).toContain("text-monti-display");
		expect(classes).toContain("md:text-monti-display");
		expect(classes).not.toContain("text-base");
		expect(classes).not.toContain("md:text-sm");
	});

	it("keeps a text color next to a type scale role", () => {
		const classes = cn("text-monti-caption", "text-monti-muted-foreground").split(" ");
		expect(classes).toContain("text-monti-caption");
		expect(classes).toContain("text-monti-muted-foreground");
	});
});
