#!/usr/bin/env node
/**
 * Keeps the code in `docs/recipes/*.md` equal to the recipe sources. A fenced block that follows a marker line is the file the marker names:
 *
 *   <!-- source: examples/recipes/src/slug-rule/slug-rule.ts -->
 *   ```ts
 *   …the file, as it is…
 *   ```
 *
 *   node scripts/sync-recipe-docs.mjs          # rewrite the blocks from the files
 *   node scripts/sync-recipe-docs.mjs --check  # fail when a block differs (the recipes test runs this)
 *
 * The recipes are tested code (`examples/recipes`), so a page can never show code that does not run.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs", "recipes");
const check = process.argv.includes("--check");

const BLOCK = /<!-- source: (\S+) -->\n```(\w*)\n([\s\S]*?)\n```/g;

const stale = [];
for (const name of readdirSync(docs).filter((file) => file.endsWith(".md"))) {
	const file = path.join(docs, name);
	const text = readFileSync(file, "utf8");
	const next = text.replace(BLOCK, (_whole, source, lang) => {
		const code = readFileSync(path.join(root, source), "utf8").replace(/\n+$/, "");
		return `<!-- source: ${source} -->\n\`\`\`${lang}\n${code}\n\`\`\``;
	});
	if (next === text) continue;
	if (check) stale.push(path.relative(root, file));
	else writeFileSync(file, next);
}

if (stale.length > 0) {
	console.error(
		`These recipe pages show code that differs from the recipe files: ${stale.join(", ")}\nRun \`node scripts/sync-recipe-docs.mjs\` to update them.`,
	);
	process.exit(1);
}
