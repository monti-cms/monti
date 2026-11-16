// The one loader of a site's `monti.config.ts` and of the files it imports (TypeScript and TSX, through jiti): the `monti` command and a site's own
// scripts (a seed) use it, so a block that imports a stylesheet loads the same way in each.
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

/**
 * A loader for `parent` (the file that asks, `import.meta.url`). The site's blocks are TSX (doc 18: `monti add` copies them in, and the config imports
 * them): React's automatic runtime, as Next uses. The formula block imports KaTeX's stylesheet for the site's bundler; a script has no page to put it
 * in, so it reads as an empty module.
 */
export function createLoader(parent) {
	return createJiti(parent, {
		jsx: { runtime: "automatic" },
		alias: { "katex/dist/katex.min.css": fileURLToPath(new URL("./no-style.mjs", import.meta.url)) },
	});
}
