import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const pages = path.join(root, "docs/recipes");

/** A recipe page is only worth reading if the code on it is the code that is tested. */
describe("the recipe pages", () => {
	it("show the code of the recipe files", () => {
		const run = spawnSync("node", ["scripts/sync-recipe-docs.mjs", "--check"], { cwd: root, encoding: "utf8" });
		expect(run.stderr).toBe("");
		expect(run.status).toBe(0);
	});

	it("exist for every recipe folder, and the index links every page", () => {
		const recipes = readdirSync(pages).filter((name) => name.endsWith(".md") && !name.startsWith("README"));
		const index = readFileSync(path.join(pages, "README.md"), "utf8");
		const folders = readdirSync(import.meta.dirname).filter((name) => !name.includes("."));
		for (const folder of folders) {
			const page = recipes.find((name) =>
				readFileSync(path.join(pages, name), "utf8").includes(`examples/recipes/src/${folder}`),
			);
			expect({ folder, page: Boolean(page) }).toEqual({ folder, page: true });
		}
		for (const name of recipes) expect(index).toContain(`(${name})`);
	});
});
