/**
 * Keeps the code on the recipe pages (`docs/recipes/*.md`) equal to the recipe files that are type checked (`docs/recipes/src`, the `@monti-cms/recipes` package).
 *
 *   pnpm check:recipes           # fails when a code block differs from its file, or a ts/tsx block names no file
 *   pnpm check:recipes --write   # copies each file into its code block
 *
 * A code block names its file in the comment on the line before it: `<!-- src/post-stats/server.ts -->`, then a ```ts or ```tsx fence.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/recipes");
const write = process.argv.includes("--write");
const BLOCK = /(<!-- (src\/[^\s]+) -->\n)?```(ts|tsx)\n([\s\S]*?)```/g;

const problems = [];
for (const name of readdirSync(dir).filter((file) => file.endsWith(".md") && !file.startsWith("README"))) {
	const page = path.join(dir, name);
	const text = readFileSync(page, "utf8");
	const next = text.replace(BLOCK, (block, marker, file, lang, code) => {
		if (!file) {
			problems.push(`${name}: a \`\`\`${lang} block names no file (put <!-- src/<path> --> on the line before it)`);
			return block;
		}
		let source;
		try {
			source = readFileSync(path.join(dir, file), "utf8");
		} catch {
			problems.push(`${name}: ${file} does not exist`);
			return block;
		}
		if (source === code) return block;
		if (!write) problems.push(`${name}: the block of ${file} differs from the file (run pnpm check:recipes --write)`);
		return `${marker}\`\`\`${lang}\n${source}\`\`\``;
	});
	if (write && next !== text) {
		writeFileSync(page, next);
		console.log(`check-recipes: updated ${name}`);
	}
}

if (problems.length > 0) {
	for (const problem of problems) console.error(`check-recipes: ${problem}`);
	process.exit(1);
}
console.log("check-recipes: ok");
