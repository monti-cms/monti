// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packagesDir = path.resolve(__dirname, "../../..");

/** Non-test `.ts` and `.tsx` files of every package's `src`. */
function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "__test__" || entry.name === "node_modules" ? [] : sourceFiles(full);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}

describe("type scale", () => {
	it("uses a text-monti-* role instead of an arbitrary px or rem font size", () => {
		const offenders: string[] = [];
		for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
			const src = path.join(packagesDir, pkg.name, "src");
			if (!pkg.isDirectory() || !readdirSync(path.join(packagesDir, pkg.name)).includes("src")) continue;
			for (const file of sourceFiles(src)) {
				readFileSync(file, "utf8")
					.split("\n")
					.forEach((line, index) => {
						for (const match of line.matchAll(/text-\[[\d.]+(?:px|rem)\]/g)) {
							offenders.push(`${path.relative(packagesDir, file)}:${index + 1} ${match[0]}`);
						}
					});
			}
		}
		expect(offenders).toEqual([]);
	});
});
