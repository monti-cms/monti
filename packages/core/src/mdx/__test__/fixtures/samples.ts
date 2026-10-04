import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter } from "../../frontmatter";

/** Real post bodies for regression tests. Only posts with varied syntax were picked from the earlier file-based posts. */
// The test runner provides `__dirname`; the package built as ESM (`dist`) finds them through `import.meta.url`.
export const SAMPLES_DIR =
	typeof __dirname === "string" ? path.join(__dirname, "samples") : fileURLToPath(new URL("samples", import.meta.url));

export const readSample = (name: string): string => readFileSync(path.join(SAMPLES_DIR, name), "utf8");

/** All sample posts. `mdx` is the body with the front matter removed (the shape stored in the DB). */
export const readSamples = (): { name: string; mdx: string }[] =>
	readdirSync(SAMPLES_DIR)
		.filter((file) => file.endsWith(".mdx"))
		.sort()
		.map((name) => ({ name, mdx: splitFrontmatter(readSample(name)).body }));
