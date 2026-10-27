import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cn } from "../cn";

const themeCss = readFileSync(path.resolve(__dirname, "../../styles/theme.css"), "utf8");
/** The names the generated theme defines for a theme namespace (`--spacing-monti-12` → `12`). */
const themed = (namespace: string) =>
	[...themeCss.matchAll(new RegExp(`--${namespace}-monti-([\\w-]+):`, "g"))].map((match) => match[1]);

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
		expect(cn("bg-monti-page text-monti-default", "bg-monti-tool text-monti-muted")).toBe(
			"bg-monti-tool text-monti-muted",
		);
		expect(cn("shadow-none", "shadow-monti-floating")).toBe("shadow-monti-floating");
	});

	it("treats the spacing scale as spacing, beside Tailwind's numbers", () => {
		expect(cn("gap-monti-4 px-monti-16", "gap-monti-48 px-monti-8")).toBe("gap-monti-48 px-monti-8");
		expect(cn("px-2.5", "px-monti-8")).toBe("px-monti-8");
	});

	it("merges every name of the generated theme with the others of its kind", () => {
		const families: [string, string[]][] = [
			["p", themed("spacing")],
			["gap", themed("spacing")],
			["rounded", themed("radius")],
			["rounded-t", themed("radius")],
			["shadow", themed("shadow")],
			["h", themed("height")],
			["min-h", themed("height")],
			["size", themed("size")],
			["w", themed("container")],
			["min-w", themed("container")],
			["max-w", themed("container")],
			["text", [...themeCss.matchAll(/@utility text-monti-([\w-]+)/g)].map((match) => match[1])],
		];
		for (const [utility, names] of families) {
			expect(names.length, utility).toBeGreaterThan(1);
			for (const name of names) {
				const other = names.find((candidate) => candidate !== name) as string;
				expect(cn(`${utility}-monti-${other}`, `${utility}-monti-${name}`), `${utility}-monti-${name}`).toBe(
					`${utility}-monti-${name}`,
				);
			}
		}
	});
});
