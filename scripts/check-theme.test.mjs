import assert from "node:assert/strict";
import test from "node:test";
import { blocksSync, themeToken } from "./check-theme.mjs";

const style = (css) => `export const style = \`${css}\`;\n`;

test("theme-token: a colour in a rule fails, one on a custom property and a var() read pass, a comment is not a colour", () => {
	const found = themeToken(
		{
			"packages/blocks/blocks/callout/style.ts": style(
				"/* the tip is oklch(0.6 0.15 155) */\n:where(:root) {\n\t--tip: oklch(0.6 0.15 155);\n}\n.a {\n\tcolor: var(--tip);\n\tborder-color: #ff0000;\n\tbackground: var(--x, rgb(0 0 0 / 0.1));\n}",
			),
			"packages/core/render.css": ".a {\n\tbox-shadow: 0 1px hsl(0 0% 0% / 0.2);\n}\n:root {\n\t--b: #123456;\n}\n",
			"packages/blocks/blocks/tabs/tabs.test.tsx": "const a = '#ffffff';",
			"packages/ui/src/x.tsx": "const a = '#ffffff';",
		},
		{ allowed: new Map() },
	);
	assert.deepEqual(
		found.map(({ file, line }) => [file, line]),
		[
			["packages/blocks/blocks/callout/style.ts", 7],
			["packages/blocks/blocks/callout/style.ts", 8],
			["packages/core/render.css", 2],
		],
	);
});

test("theme-token: a colour literal in a block's code fails unless the file is named, and the default themes and outputs are checked", () => {
	const sources = {
		"packages/blocks/blocks/mermaid/look.ts": 'const reset = "#000000";\n',
		"packages/blocks/blocks/mermaid/other.ts": 'const a = "#101010"; // not "#ffffff"\n',
		"packages/blocks/blocks/mermaid/view.tsx":
			'mermaid.initialize({ theme: dark ? "dark" : "default" });\nmermaid.initialize({ theme: "default" });\n',
		"packages/blocks/blocks/math/site.tsx": 'katex.renderToString(s, { output: "mathml" });\n',
		"packages/core/src/code/highlight.ts": 'const t = "github-light";\n// "github-dark" in a comment\n',
		"packages/core/src/code/monti-theme.generated.ts": 'export const A = "#ffffff";\n',
	};
	const found = themeToken(sources, { allowed: new Map([["blocks/blocks/mermaid/look.ts", "a reset"]]) });
	assert.deepEqual(
		found.map(({ file, line }) => [file, line]),
		[
			["packages/blocks/blocks/mermaid/other.ts", 1],
			["packages/blocks/blocks/mermaid/view.tsx", 1],
			["packages/blocks/blocks/mermaid/view.tsx", 2],
			["packages/blocks/blocks/math/site.tsx", 1],
			["packages/core/src/code/highlight.ts", 1],
		],
	);
});

test("theme-token: a LITERAL_OK entry for a file with no literal any more fails", () => {
	const found = themeToken(
		{ "packages/blocks/blocks/mermaid/look.ts": "const a = 1;\n" },
		{ allowed: new Map([["blocks/blocks/mermaid/look.ts", "a reset"]]) },
	);
	assert.equal(found.length, 1);
	assert.match(found[0].message, /no colour literal in code any more/);
});

test("blocks-sync: a copy that differs, an extra file and a missing file fail; the block lists and a block the site left out do not", () => {
	const found = blocksSync({
		"packages/blocks/blocks/callout/style.ts": "a",
		"packages/blocks/blocks/callout/site.tsx": "s",
		"packages/blocks/blocks/callout/blocks.test.tsx": "t",
		"packages/blocks/blocks/tabs/style.ts": "x",
		"packages/blocks/blocks/index.ts": "list",
		"examples/blog/monti/blocks/index.ts": "its own list",
		"examples/blog/monti/blocks/admin.ts": "its own",
		"examples/blog/monti/blocks/callout/style.ts": "changed",
		"examples/blog/monti/blocks/callout/extra.ts": "e",
		"examples/shop/monti/blocks/callout/style.ts": "a",
	});
	assert.deepEqual(found.map(({ file }) => file).sort(), [
		"examples/blog/monti/blocks/callout/extra.ts",
		"examples/blog/monti/blocks/callout/site.tsx",
		"examples/blog/monti/blocks/callout/style.ts",
		"examples/shop/monti/blocks/callout/site.tsx",
	]);
});
