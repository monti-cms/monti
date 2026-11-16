/**
 * The looks of what is not the admin (`check:design` runs both): the colours of code, formulas, diagrams and the site's blocks come from tokens, and the
 * examples' copies of the blocks stay the package's own.
 *
 *   theme-token   The look files (`packages/blocks/blocks/<block>/style.ts` and the block's `.ts`/`.tsx`, `packages/core/render.css`,
 *                 `packages/core/src/code/*.ts`) hold no colour of their own outside a declaration. A colour literal (`#rrggbb`, `rgb()`,
 *                 `hsl()`, `oklch()`, `lab()`, `color()`) is written once, on a custom property (`--monti-callout-tip: ...`), and every rule
 *                 reads it with `var()`: a fallback written inside `var(--x, <literal>)` in a rule fails too. The syntax colours of code are the
 *                 generated `monti-theme.generated.ts` (from `tokens.json`); Mermaid is `base` with colours read from the page
 *                 (`mermaid/look.ts`); KaTeX is `htmlAndMathml`, not the browser's MathML alone; Shiki's default is Monti's pair, never a GitHub one.
 *                 `LITERAL_OK` names a file that holds a literal in code with the reason.
 *   blocks-sync   Every file of a block in `examples/*\/monti/blocks/<block>/` is the one of `packages/blocks/blocks/<block>/` (the site's own copy that
 *                 `monti add` made), except the block lists (`index.ts`, `admin.ts`), which are the site's. The editor's look of a site block and the
 *                 site's own `style.ts` are one source, so a change to a block is made in the package and copied.
 *
 * Cannot see: a colour written as a name (`white`, `tomato`) or built from a variable the file does not define; a literal in a CSS string that a
 * file builds from parts; a value passed to `mermaid.initialize` or `katex.renderToString` through a variable; and a copy that a site changed on
 * purpose (it fails here until the site's file is named, which is a decision for the site, not for this check).
 */

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
const blank = (match) => match.replace(/[^\n]/g, " ");

/** A file of the look: a block's own files, the core's code look and the core's code colours. */
const inLookFiles = (file) =>
	(/^packages\/blocks\/blocks\/[^/]+\/[^/]+\.(?:ts|tsx)$/.test(file) ||
		file === "packages/core/render.css" ||
		/^packages\/core\/src\/code\/[^/]+\.ts$/.test(file)) &&
	!/\.(?:test|generated)\.tsx?$/.test(file) &&
	!/\/(?:index|words)\.ts$/.test(file);

/** Colour literals a file may hold in code (not in a rule of its look), with the reason. */
export const LITERAL_OK = new Map([
	[
		"blocks/blocks/mermaid/look.ts",
		"the colour reader resets its canvas to black before it reads a colour back from it; that pixel is never drawn",
	],
]);

const LITERAL = /#[\da-f]{6}\b|#[\da-f]{3}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/i;
const DECLARATION = /^\s*--[\w-]+\s*:/;

export function themeToken(sources, { allowed = LITERAL_OK } = {}) {
	const found = [];
	const used = new Set();
	for (const [file, source] of Object.entries(sources)) {
		if (!inLookFiles(file)) continue;
		const key = file.replace(/^packages\//, "");
		const css = file.endsWith(".css") || file.endsWith("/style.ts");
		// Comments say things, they draw none.
		const text = css
			? source.replace(/\/\*[\s\S]*?\*\//g, blank)
			: source.replace(/\/\*[\s\S]*?\*\/|(?<![:"'`])\/\/[^\n]*/g, blank);
		text.split("\n").forEach((line, index) => {
			if (!LITERAL.test(line)) return;
			if (css) {
				if (DECLARATION.test(line)) return;
				found.push({
					file,
					line: index + 1,
					message: "a colour of its own in a rule: declare it once on a custom property and read it with var()",
				});
			} else if (allowed.has(key)) used.add(key);
			else
				found.push({
					file,
					line: index + 1,
					message:
						"a colour literal in code: read it from the page or the generated theme, or name the file in LITERAL_OK with the reason",
				});
		});
		const at = (pattern, message) => {
			const hit = pattern.exec(text);
			if (hit) found.push({ file, line: lineOf(text, hit.index), message });
		};
		if (!css) {
			at(
				/output:\s*["']mathml["']/,
				'KaTeX draws `output: "htmlAndMathml"`: the browser\'s MathML alone breaks matrices, limits and alignment',
			);
			at(
				/theme:\s*["'](?:default|dark|neutral|forest)["']/,
				'Mermaid draws `theme: "base"` with the colours of `mermaidLook`, never one of its own themes',
			);
			at(
				/["']github-(?:light|dark)["']/,
				"the default code colours are Monti's pair (monti-light, monti-dark), not a GitHub theme",
			);
		}
	}
	for (const key of allowed.keys())
		if (!used.has(key))
			found.push({
				file: `packages/${key}`,
				line: 1,
				message: "LITERAL_OK names a file with no colour literal in code any more",
			});
	return found;
}

const SITE_OWN = new Set(["index.ts", "admin.ts"]);

/** `sources` holds the files of `packages/blocks/blocks` and of `examples/<site>/monti/blocks` by path. */
export function blocksSync(sources) {
	const found = [];
	const prefix = "packages/blocks/blocks/";
	const own = (file) =>
		file.startsWith(prefix) && file.slice(prefix.length).includes("/") && !/\.test\.tsx?$/.test(file);
	for (const [file, source] of Object.entries(sources)) {
		const copy = /^(examples\/[^/]+\/monti\/blocks\/)([^/]+)\/(.+)$/.exec(file);
		if (!copy || SITE_OWN.has(`${copy[2]}/${copy[3]}`)) continue;
		const original = sources[`${prefix}${copy[2]}/${copy[3]}`];
		if (original === undefined)
			found.push({
				file,
				line: 1,
				message: "a file of a block that the package does not have: the site's copy must be the package's own",
			});
		else if (original !== source)
			found.push({
				file,
				line: 1,
				message: `differs from ${prefix}${copy[2]}/${copy[3]}: change the block in the package and copy it`,
			});
	}
	for (const file of Object.keys(sources).filter(own)) {
		const [block, ...rest] = file.slice(prefix.length).split("/");
		for (const site of new Set(
			Object.keys(sources).flatMap((other) => /^(examples\/[^/]+\/monti\/blocks\/)/.exec(other)?.[1] ?? []),
		)) {
			const hasBlock = Object.keys(sources).some((other) => other.startsWith(`${site}${block}/`));
			if (hasBlock && sources[`${site}${block}/${rest.join("/")}`] === undefined)
				found.push({
					file: `${site}${block}/${rest.join("/")}`,
					line: 1,
					message: `missing: the package's ${file} is part of the block`,
				});
		}
	}
	return found;
}
